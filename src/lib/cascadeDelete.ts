// Shared flow for the four "delete X" actions that can have related records
// (treasury/party/invoice/product): try a plain delete first; if the backend
// reports a 409 (related records exist), ask once whether to delete them too
// and retry with cascade=true. Any other error is already toasted by lib/api.ts.
type CascadeMutate = {
  mutate: (
    vars: { id: string; cascade?: boolean },
    opts?: { onSuccess?: () => void; onError?: (e: any) => void },
  ) => void;
};

export function confirmCascadeDelete(
  mutation: CascadeMutate,
  id: string,
  opts?: { onSuccess?: () => void; onOtherError?: (e: any) => void },
) {
  mutation.mutate(
    { id },
    {
      onSuccess: opts?.onSuccess,
      onError: (e: any) => {
        if (e?.status === 409 && window.confirm(`${e.message}\n\nهل تريد حذفها كلها مع العنصر؟`)) {
          mutation.mutate({ id, cascade: true }, { onSuccess: opts?.onSuccess, onError: opts?.onOtherError });
        } else {
          opts?.onOtherError?.(e);
        }
      },
    },
  );
}
