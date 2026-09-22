import { useEffect } from 'react';
import { useStore } from './store/store';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { MobileNav } from './components/layout/MobileNav';
import { Toast } from './components/ui/Toast';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { CopyMessageModal } from './components/ui/CopyMessageModal';
import { Onboarding } from './components/onboarding/Onboarding';
import { NewClientModal } from './components/modals/NewClientModal';
import { NewApptModal } from './components/modals/NewApptModal';
import { ApptDetailModal } from './components/modals/ApptDetailModal';
import { CompleteScreenModal } from './components/modals/CompleteScreenModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { CancellationRescueBanner } from './components/modals/CancellationRescueBanner';
import { Home } from './screens/Home';
import { Clients } from './screens/Clients';
import { Bookings } from './screens/Bookings';
import { Money } from './screens/Money';
import { Grow } from './screens/Grow';

function Screen() {
  const section = useStore((s) => s.section);
  if (section === 'home') return <Home />;
  if (section === 'clients') return <Clients />;
  if (section === 'bookings') return <Bookings />;
  if (section === 'money') return <Money />;
  return <Grow />;
}

export default function App() {
  const showOnboarding = useStore((s) => s.showOnboarding);
  const setMobile = useStore((s) => s.setMobile);
  const showSidebarMobile = useStore((s) => s.showSidebarMobile);
  const closeSidebarMobile = useStore((s) => s.closeSidebarMobile);
  const setSection = useStore((s) => s.setSection);
  const section = useStore((s) => s.section);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMobile]);

  if (showOnboarding) {
    return <Onboarding />;
  }

  return (
    <div className="flex min-h-svh flex-col bg-ivory-100 text-ink-900">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {showSidebarMobile && (
          <div className="fixed inset-0 z-[150] flex md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={closeSidebarMobile} />
            <div className="relative z-10 flex w-[220px] flex-col gap-1 bg-white p-4 shadow-xl animate-lum-pop">
              {(['home', 'clients', 'bookings', 'money', 'grow'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSection(s); closeSidebarMobile(); }}
                  className={`rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold capitalize ${section === s ? 'bg-plum-100 text-plum-600' : 'text-ink-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 md:px-8 md:pb-16 md:pt-7">
          <Screen />
        </div>
      </div>
      <MobileNav />

      <Toast />
      <ConfirmDialog />
      <CopyMessageModal />
      <NewClientModal />
      <NewApptModal />
      <ApptDetailModal />
      <CompleteScreenModal />
      <SettingsModal />
      <RecordPaymentModal />
      <CancellationRescueBanner />
    </div>
  );
}
