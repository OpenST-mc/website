import { useSession } from '../hooks/useSession';
import { signIn, signOut } from '../lib/auth';

interface AuthButtonProps {
  callbackUrl?: string;
  className?: string;
}

// 登录/登出按钮：基于 Auth.js 会话。upload/admin 等页复用。
export function AuthButton({ callbackUrl = '/', className }: AuthButtonProps) {
  const { user, status } = useSession();

  if (status === 'loading') {
    return (
      <button type="button" disabled className={className}>
        检查登录状态...
      </button>
    );
  }

  if (user) {
    return (
      <button type="button" onClick={() => void signOut()} className={className}>
        退出登录（{user.name ?? '已登录'}）
      </button>
    );
  }

  return (
    <button type="button" onClick={() => void signIn('github', callbackUrl)} className={className}>
      使用 GitHub 登录
    </button>
  );
}
