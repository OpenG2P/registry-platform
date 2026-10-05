import { RegisterTabsProvider } from '@/context/RegisterTabsContext';

export default function RegisterRecordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RegisterTabsProvider>
            {children}
        </RegisterTabsProvider>
    );
}
