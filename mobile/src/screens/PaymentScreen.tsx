import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme/tokens';
import { usePricing, useCreateOrder, useVerifyPayment } from '../api/hooks/usePricing';
import { useSendInterest } from '../api/hooks/useInterests';
import { useToastStore } from '../store/uiStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

type RazorpayMessage =
  | { type: 'success'; paymentId: string; orderId: string; signature: string }
  | { type: 'dismiss' }
  | { type: 'error'; message?: string };

function buildCheckoutHtml(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
}) {
  const optionsJson = JSON.stringify({
    key: opts.keyId,
    amount: opts.amount,
    currency: opts.currency,
    order_id: opts.orderId,
    name: 'Kifaah',
    description: opts.description,
    theme: { color: '#ec3013' },
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;background:#f3f2f2">
<script>
  function post(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  try {
    var options = ${optionsJson};
    options.handler = function (response) {
      post({ type: 'success', paymentId: response.razorpay_payment_id, orderId: response.razorpay_order_id, signature: response.razorpay_signature });
    };
    options.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      post({ type: 'error', message: (response && response.error && response.error.description) || 'Payment failed' });
    });
    rzp.open();
  } catch (e) {
    post({ type: 'error', message: String(e) });
  }
</script>
</body>
</html>`;
}

export function PaymentScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const { tier, billing, returnTo, pendingInterestProfileId } = route.params;

  const { data: pricing } = usePricing();
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();
  const sendInterest = useSendInterest();
  const showToast = useToastStore((s) => s.show);

  const [checkoutHtml, setCheckoutHtml] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayAmount = pricing ? pricing[tier][billing] : null;
  const tierLabel = tier === 'premium' ? 'Premium' : 'Basic';
  const billingLabel = billing === 'annual' ? 'Annual' : 'Monthly';

  const startPayment = async () => {
    setError(null);
    setProcessing(true);
    try {
      const order = await createOrder.mutateAsync({ tier, billing });
      setCheckoutHtml(
        buildCheckoutHtml({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          description: `${tierLabel} · ${billingLabel}`,
        })
      );
    } catch (e: any) {
      setProcessing(false);
      setError(e?.message || 'Could not start checkout. Please try again.');
    }
  };

  const onWebViewMessage = async (event: WebViewMessageEvent) => {
    let msg: RazorpayMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (msg.type === 'dismiss') {
      setCheckoutHtml(null);
      setProcessing(false);
      return;
    }
    if (msg.type === 'error') {
      setCheckoutHtml(null);
      setProcessing(false);
      setError(msg.message || 'Payment failed. Please try again.');
      return;
    }
    if (msg.type === 'success') {
      try {
        await verifyPayment.mutateAsync({ orderId: msg.orderId, paymentId: msg.paymentId, signature: msg.signature });
        if (pendingInterestProfileId) {
          await sendInterest.mutateAsync(pendingInterestProfileId);
        }
        setCheckoutHtml(null);
        showToast('Subscription active');
        if (returnTo === 'detail' && pendingInterestProfileId) {
          navigation.navigate('ProfileDetail', { profileId: pendingInterestProfileId, origin: 'discover' });
        } else {
          navigation.navigate('Main', { screen: 'Account' });
        }
      } catch (e: any) {
        setCheckoutHtml(null);
        setProcessing(false);
        setError(e?.message || 'Could not verify payment. Please contact support.');
      }
    }
  };

  return (
    <Screen>
      <Header title="Payment" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryTitle}>
              {tierLabel} · {billingLabel}
            </Text>
            <Text style={styles.summaryNote}>Auto-renews, cancel anytime</Text>
          </View>
          <Text style={styles.summaryAmount}>{displayAmount !== null ? `₹${displayAmount}` : '—'}</Text>
        </View>

        <View style={styles.payVia}>
          <Text style={styles.eyebrow}>Pay via</Text>
          <Text style={styles.payViaNote}>
            UPI, Card and Netbanking are all available in Razorpay's secure checkout.
          </Text>
          <Text style={styles.securedNote}>
            Processed securely by <Text style={{ fontFamily: fonts.extraBold }}>Razorpay</Text>
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {processing && !checkoutHtml ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color={colors.red} />
            <Text style={styles.processingText}>Processing payment…</Text>
          </View>
        ) : (
          <Button
            title={displayAmount !== null ? `Pay ₹${displayAmount}` : 'Pay'}
            onPress={startPayment}
            disabled={displayAmount === null}
          />
        )}
      </View>

      <Modal visible={!!checkoutHtml} animationType="slide" onRequestClose={() => setCheckoutHtml(null)}>
        <Screen>
          <Header title="Checkout" onBack={() => setCheckoutHtml(null)} />
          {checkoutHtml ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: checkoutHtml }}
              onMessage={onWebViewMessage}
              style={{ flex: 1 }}
            />
          ) : null}
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 20,
    gap: 18,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  summaryNote: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  summaryAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.ink,
  },
  payVia: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  payViaNote: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
    lineHeight: 19,
  },
  securedNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  processingRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  error: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.redDark,
  },
});
