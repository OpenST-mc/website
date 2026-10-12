interface NavUser {
  name?: string | null;
  image?: string | null;
}

interface NavBarProps {
  user: NavUser | null;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenMenu: () => void;
}

export function NavBar({ user, isAdmin, onLogin, onLogout, onOpenMenu }: NavBarProps) {
  return (
    <nav className="h-16 bg-black/20 border-b border-white/5 flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="打开筛选菜单"
          className="md:hidden p-2 -ml-2 text-gray-400 hover:text-brand transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="font-bold tracking-tighter text-brand text-xl">
          <a href="https://github.com/OpenST-mc/website">OpenST档案馆</a>{' '}
          <span className="hidden sm:inline text-white/40 text-xs tracking-normal ml-1 font-normal uppercase">v4.5</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 border-l border-white/10 pl-6">
          {user ? (
            <>
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-bold text-white">{user.name}</span>
                {isAdmin ? <span className="text-[9px] bg-brand/20 text-brand px-1 rounded">STAFF</span> : null}
              </div>
              {user.image ? <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-white/10" /> : null}
              <button
                type="button"
                onClick={onLogout}
                aria-label="退出登录"
                className="text-gray-500 hover:text-red-400 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="text-xs font-bold bg-white text-black px-4 py-1.5 rounded-full hover:bg-brand transition-colors"
            >
              GitHub 登录
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
