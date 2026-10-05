import { useCallback, useEffect, useRef, useState } from 'react';

export const HOME_TRANSITION_LOGS = [
  'SPOOFING_IP...',
  'DECRYPTING_V_FILES...',
  'BYPASSING_GATE...',
  'ACCESS_GRANTED',
] as const;

export interface HomeEffects {
  transitioning: boolean;
  logIndex: number;
  onSecretClick: (el: HTMLElement | null) => void;
}

// 门户页交互：彩蛋五连击过渡、字体解锁、控制台安全提示。
// 所有浏览器副作用都限定在 useEffect / 事件回调内（SSG 安全）。
export function useHomeEffects(): HomeEffects {
  const [transitioning, setTransitioning] = useState(false);
  const [logIndex, setLogIndex] = useState(0);
  const clickCount = useRef(0);
  const lastClick = useRef(0);

  const onSecretClick = useCallback((el: HTMLElement | null) => {
    const now = Date.now();
    if (now - lastClick.current > 800) clickCount.current = 0;
    clickCount.current += 1;
    lastClick.current = now;

    if (el) {
      el.style.filter = 'brightness(2)';
      el.style.transition = 'filter 0.1s';
      window.setTimeout(() => {
        el.style.filter = 'brightness(1)';
      }, 100);
    }

    if (clickCount.current === 5) {
      clickCount.current = 0;
      setTransitioning(true);
    }
  }, []);

  // 字体加载完成后解锁骨架屏
  useEffect(() => {
    const unlock = () => {
      document.querySelectorAll('.loading-skeleton').forEach((el) => el.classList.remove('loading-skeleton'));
      document.body.classList.add('ready');
      console.log('%c字体加载成功', 'color: #40B5AD; font-weight: bold;');
    };
    let readyTimer: number | undefined;
    const onLoad = () => unlock();
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        readyTimer = window.setTimeout(unlock, 200);
      });
    } else {
      window.addEventListener('load', onLoad);
    }
    const failsafe = window.setTimeout(() => {
      if (document.querySelector('.loading-skeleton')) {
        console.warn('SYSTEM: FONT_LOAD_TIMEOUT, FORCING_DISPLAY');
        unlock();
      }
    }, 2500);
    return () => {
      if (readyTimer) window.clearTimeout(readyTimer);
      window.clearTimeout(failsafe);
      window.removeEventListener('load', onLoad);
    };
  }, []);

  // 控制台安全提示
  useEffect(() => {
    console.log(
      '%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。',
      'color: #333; font-size: 16px; font-weight: bold;',
      'color: red; font-size: 14px;',
    );
  }, []);

  // 过渡动画：锁定滚动并推进日志
  useEffect(() => {
    if (!transitioning) return;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    const id = window.setInterval(() => setLogIndex((v) => v + 1), 600);
    return () => window.clearInterval(id);
  }, [transitioning]);

  // 日志播完跳转 credits
  useEffect(() => {
    if (transitioning && logIndex > HOME_TRANSITION_LOGS.length) {
      window.location.href = '/profile/april/december';
    }
  }, [transitioning, logIndex]);

  return { transitioning, logIndex, onSecretClick };
}
