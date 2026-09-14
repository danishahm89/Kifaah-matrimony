import { useMutation, useQuery } from '@tanstack/react-query';
import { profileApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';
import type { Profile } from '../../types';

export function useProfileMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profileMe,
    queryFn: profileApi.me,
    enabled,
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => profileApi.update(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profileMe, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

export function useUploadPhoto() {
  return useMutation({
    mutationFn: (vars: { uri: string; name: string; mimeType: string }) =>
      profileApi.uploadPhoto(vars.uri, vars.name, vars.mimeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profileMe });
    },
  });
}
