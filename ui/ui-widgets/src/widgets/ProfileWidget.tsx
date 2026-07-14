import { useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { WidgetRootState } from '../store';
import { useWidgetContext } from '../components/WidgetProvider';
import { getValueByPath } from '../utils/pathUtils';
import { dummyProfile } from '../assets';

interface ProfileWidgetProps {
  config: BaseWidgetConfig;
}

export const ProfileWidget = ({ config }: ProfileWidgetProps) => {
  const {
    config: widgetConfig,
    getFieldValue,
  } = useBaseWidget({ config });

  const { schemaData, t } = useWidgetContext();

  const values = useSelector((state: WidgetRootState) => state.widget.values);

  let imageUrl: string | null = null;
  let displayName = '';
  let idValue = '';

  const dataPath = widgetConfig['widget-data-path'];
  const imagePath = (widgetConfig as any)['widget-image-path'];
  const namePath = (widgetConfig as any)['widget-name-path'];
  const idPath = (widgetConfig as any)['widget-id-path'];

  if (dataPath && typeof dataPath === 'object') {
    const imagePathValue = dataPath.image || dataPath.photo || dataPath.avatar;
    const namePathValue = dataPath.name || dataPath.displayName;
    const idPathValue = dataPath.id || dataPath.identifier;

    const findValueInNestedObjects = (path: string, searchIn: Record<string, any> | undefined): any => {
      if (!searchIn) return undefined;

      let value = getValueByPath(searchIn, path);
      if (value !== undefined) return value;

      for (const obj of Object.values(searchIn)) {
        if (obj && typeof obj === 'object') {
          value = getValueByPath(obj, path);
          if (value !== undefined) {
            return value;
          }
        }
      }

      return undefined;
    };

    if (imagePathValue) {
      let fetchedImage = findValueInNestedObjects(imagePathValue, values);
      if (fetchedImage === undefined && schemaData) {
        fetchedImage = findValueInNestedObjects(imagePathValue, schemaData);
      }
      imageUrl = fetchedImage || null;
    }
    if (namePathValue) {
      let fetchedName = findValueInNestedObjects(namePathValue, values);
      if (fetchedName === undefined && schemaData) {
        fetchedName = findValueInNestedObjects(namePathValue, schemaData);
      }
      displayName = fetchedName || '';
    }
    if (idPathValue) {
      let fetchedId = findValueInNestedObjects(idPathValue, values);
      if (fetchedId === undefined && schemaData) {
        fetchedId = findValueInNestedObjects(idPathValue, schemaData);
      }
      idValue = fetchedId || '';
    }
  } else {
    if (imagePath) {
      const imageValue = getFieldValue(imagePath);
      imageUrl = imageValue || null;
    }
    if (namePath) {
      displayName = getFieldValue(namePath) || '';
    }
    if (idPath) {
      idValue = getFieldValue(idPath) || '';
    }
  }

  const format = widgetConfig['widget-data-format'] || {};
  const imageSize = (format as any).imageSize || 80;
  const nameColor = (format as any).nameColor || 'var(--owt-color-primary-dark, #F07B1A)';
  const showIdLabel = (format as any).showIdLabel !== false;

  const widgetClassId = `profile-widget-${config['widget-id']}`;

  return (
    <>
      <style>{`
        .${widgetClassId} {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 1rem;
          width: 100%;
        }
        
        .${widgetClassId} .profile-avatar-container {
          position: relative;
          flex-shrink: 0;
        }
        
        .${widgetClassId} .profile-avatar {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          object-fit: cover;
          background-color: var(--owt-color-border-light, #e5e7eb);
          border: 2px solid var(--owt-color-border, #d1d5db);
          flex-shrink: 0;
        }
        
        .${widgetClassId} .profile-avatar-placeholder {
          width: ${imageSize}px;
          height: ${imageSize}px;
          border-radius: 8px;
          background-color: var(--owt-color-border-light, #e5e7eb);
          border: 2px solid var(--owt-color-border, #d1d5db);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .${widgetClassId} .profile-avatar-placeholder img {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          object-fit: cover;
        }
        
        .${widgetClassId} .profile-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
        }
        
        .${widgetClassId} .profile-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: ${nameColor};
          line-height: 1.4;
          word-wrap: break-word;
          max-width: 100%;
        }
        
        .${widgetClassId} .profile-id {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          font-size: 0.875rem;
          line-height: 1.4;
        }
        
        .${widgetClassId} .profile-id-label {
          color: var(--owt-color-text-muted, #6b7280);
          font-weight: 500;
        }
        
        .${widgetClassId} .profile-id-value {
          color: var(--owt-color-text, #111827);
          font-weight: 400;
        }
      `}</style>
      <div className={widgetClassId}>
        <div className="profile-avatar-container">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName || (t?.('profile.profileAlt') ?? 'Profile')}
              className="profile-avatar"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.parentElement?.querySelector('.profile-avatar-placeholder') as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className="profile-avatar-placeholder"
            style={{ display: imageUrl ? 'none' : 'flex' }}
          >
            <img
              src={dummyProfile}
              alt={t?.('profile.profilePlaceholderAlt') ?? 'Profile Placeholder'}
            />
          </div>
        </div>

        <div className="profile-info">
          {displayName && (
            <div className="profile-name">
              {displayName}
            </div>
          )}

          {idValue && (
            <div className="profile-id">
              {showIdLabel && (
                <span className="profile-id-label">{t?.('profile.idLabel') ?? 'ID :'}</span>
              )}
              <span className="profile-id-value">{idValue}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

