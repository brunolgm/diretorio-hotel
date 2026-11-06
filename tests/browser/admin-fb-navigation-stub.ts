export const usePathname = () => location.pathname;
export const useSearchParams = () => new URLSearchParams(location.search);
export const useRouter = () => ({ push: () => {}, replace: () => {}, prefetch: () => {} });
