'use client';

import { useRouter } from 'next/navigation';
import { ChangeRequest } from '@/features/change-request/types';
import { ChangeRequestCard } from '@/features/change-request/components';

interface Props {
    changeRequests: ChangeRequest[];
    getDetailsUrl: (changeRequest: ChangeRequest) => string;
}

export default function ChangeLogList({ changeRequests, getDetailsUrl }: Props) {
    const router = useRouter();

    return (
        <div className="space-y-4">
            {changeRequests.map((changeRequest) => (
                <ChangeRequestCard
                    key={changeRequest.change_request_id}
                    changeRequest={changeRequest}
                    onViewDetails={() => router.push(getDetailsUrl(changeRequest))}
                />
            ))}
        </div>
    );
}
