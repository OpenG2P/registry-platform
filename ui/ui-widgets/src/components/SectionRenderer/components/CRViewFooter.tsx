import { personIcon, calendarIcon } from '../../../assets';

export interface CRViewFooterProps {
  createdBy?: unknown;
  createdDate?: unknown;
  approvedBy?: unknown;
  approvedDate?: unknown;
}

export const CRViewFooter = ({
  createdBy,
  createdDate,
  approvedBy,
  approvedDate,
}: CRViewFooterProps) => (
  <>
    <hr
      className="w-full"
      style={{
        height: '1px',
        marginTop: '20px',
        marginBottom: '0px',
        border: 'none',
        backgroundColor: 'var(--owt-color-border, #C4C4C4)',
      }}
    />
    <div
      className="cr-view-container"
      style={{
        marginTop: '20px',
        paddingBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <div
        className="created-by-section"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}
      >
        <span
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: 'var(--owt-color-text, #011627)',
            fontWeight: 'normal',
          }}
        >
          Created by
        </span>
        <img
          src={personIcon}
          alt="Person"
          width="16"
          height="16"
          style={{
            filter:
              'brightness(0) saturate(100%) invert(56%) sepia(45%) saturate(5139%) hue-rotate(348deg) brightness(96%) contrast(92%)',
          }}
        />
        {createdBy != null && createdBy !== '' && (
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: 'var(--owt-color-text, #011627)',
              fontWeight: 'normal',
            }}
          >
            {String(createdBy)}
          </span>
        )}
        <img src={calendarIcon} alt="Calendar" width="16" height="16" style={{ marginLeft: '6px' }} />
        {createdDate != null && createdDate !== '' && (
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: 'var(--owt-color-text, #011627)',
              fontWeight: 'normal',
            }}
          >
            {String(createdDate)}
          </span>
        )}
      </div>

      <div
        className="approved-by-section"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <span
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: 'var(--owt-color-text, #011627)',
            fontWeight: 'normal',
          }}
        >
          Approved by
        </span>
        <img
          src={personIcon}
          alt="Person"
          width="16"
          height="16"
          style={{
            filter:
              'brightness(0) saturate(100%) invert(56%) sepia(45%) saturate(5139%) hue-rotate(348deg) brightness(96%) contrast(92%)',
          }}
        />
        {approvedBy != null && approvedBy !== '' && (
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: 'var(--owt-color-text, #011627)',
              fontWeight: 'normal',
            }}
          >
            {String(approvedBy)}
          </span>
        )}
        <img src={calendarIcon} alt="Calendar" width="16" height="16" style={{ marginLeft: '6px' }} />
        {approvedDate != null && approvedDate !== '' && (
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: 'var(--owt-color-text, #011627)',
              fontWeight: 'normal',
            }}
          >
            {String(approvedDate)}
          </span>
        )}
      </div>
    </div>
  </>
);
