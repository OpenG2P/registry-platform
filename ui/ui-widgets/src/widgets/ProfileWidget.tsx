import { useSelector } from 'react-redux';
import { useBaseWidget } from '../hooks/useBaseWidget';
import { BaseWidgetConfig } from '../types';
import { useWidgetTranslation } from '../hooks/useWidgetTranslation';
import { WidgetRootState } from '../store';
import { useWidgetContext } from '../components/WidgetProvider';
import { getValueByPath } from '../utils/pathUtils';
import { dummyProfile } from '../assets';

/**
 * Profile widget for displaying user identity information
 * Displays an image/avatar, display name, and ID in a vertical layout
 * 
 * This is a display widget that groups related profile fields together.
 * Recommended widget-type: 'group' (groups related data fields)
 * Alternative: 'layout' (for display-only, no value storage)
 * 
 * Configuration (Recommended - Multi-path data binding):
 * 
 * - widget-data-path: Object with keys 'image', 'name', 'id' mapping to data paths
 *   Example: { "image": "person.photo", "name": "person.name", "id": "person.id" }
 * 
 * Alternative (Individual path properties - fallback):
 * - widget-image-path?: string - Data path for the image/photo (e.g., "person.photo")
 * - widget-name-path?: string - Data path for the display name (e.g., "person.name")
 * - widget-id-path?: string - Data path for the ID (e.g., "person.id")
 * 
 * Format options:
 * - widget-data-format: Optional format configuration
 *   - imageSize?: number - Size of the avatar image in pixels (default: 80)
 *   - nameColor?: string - Color for the name text (default: '#F07B1A')
 *   - showIdLabel?: boolean - Whether to show "ID :" label (default: true)
 * 
 * Example usage (Recommended):
 * ```json
 * {
 *   "widget": "profile",
 *   "widget-type": "group",
 *   "widget-id": "user-profile",
 *   "widget-data-path": {
 *     "image": "photo",
 *     "name": "display_name",
 *     "id": "national_id"
 *   },
 *   "widget-data-format": {
 *     "imageSize": 80,
 *     "nameColor": "#F07B1A",
 *     "showIdLabel": true
 *   }
 * }
 * ```
 */
interface ProfileWidgetProps {
  config: BaseWidgetConfig;
}

export const ProfileWidget = ({ config }: ProfileWidgetProps) => {
  const {
    value,
    config: widgetConfig,
    getFieldValue,
  } = useBaseWidget({ config });

  const { translateConfig } = useWidgetTranslation();

  // Get schemaData from context as fallback
  const { schemaData } = useWidgetContext();

  // Get values from Redux store
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  // Support two approaches for data paths:
  // 1. Multi-path binding via widget-data-path (object) - RECOMMENDED (Approach 2)
  // 2. Individual path properties (widget-image-path, widget-name-path, widget-id-path) - Fallback
  let imageUrl: string | null = null;
  let displayName = '';
  let idValue = '';

  const dataPath = widgetConfig['widget-data-path'];
  const imagePath = (widgetConfig as any)['widget-image-path'];
  const namePath = (widgetConfig as any)['widget-name-path'];
  const idPath = (widgetConfig as any)['widget-id-path'];

  // Prioritize multi-path data binding (Approach 2 - Recommended)
  if (dataPath && typeof dataPath === 'object') {
    // Multi-path data binding - preferred approach (Approach 2)
    // Always fetch each path individually using getFieldValue for reliability
    // The values in the dataPath object are the actual data paths to fetch
    const imagePathValue = dataPath.image || dataPath.photo || dataPath.avatar;
    const namePathValue = dataPath.name || dataPath.displayName;
    const idPathValue = dataPath.id || dataPath.identifier;

    // Helper function to search for a path within all top-level objects
    const findValueInNestedObjects = (path: string, searchIn: Record<string, any> | undefined): any => {
      if (!searchIn) return undefined;

      // First try direct path (in case it's at root level)
      let value = getValueByPath(searchIn, path);
      if (value !== undefined) return value;

      // If not found, search within each top-level object
      for (const [key, obj] of Object.entries(searchIn)) {
        if (obj && typeof obj === 'object') {
          value = getValueByPath(obj, path);
          if (value !== undefined) {
            return value;
          }
        }
      }

      return undefined;
    };

    // Try to get values from Redux store first, then fallback to schemaData
    if (imagePathValue) {
      let fetchedImage = findValueInNestedObjects(imagePathValue, values);
      // If not found in Redux, try schemaData
      if (fetchedImage === undefined && schemaData) {
        fetchedImage = findValueInNestedObjects(imagePathValue, schemaData);
      }
      imageUrl = fetchedImage || null;
    }
    if (namePathValue) {
      let fetchedName = findValueInNestedObjects(namePathValue, values);
      // If not found in Redux, try schemaData
      if (fetchedName === undefined && schemaData) {
        fetchedName = findValueInNestedObjects(namePathValue, schemaData);
      }
      displayName = fetchedName || '';
    }
    if (idPathValue) {
      let fetchedId = findValueInNestedObjects(idPathValue, values);
      // If not found in Redux, try schemaData
      if (fetchedId === undefined && schemaData) {
        fetchedId = findValueInNestedObjects(idPathValue, schemaData);
      }
      idValue = fetchedId || '';
    }
  } else {
    // Fallback: Individual path properties
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

  // Get format options (using index access for widget-specific properties)
  const format = widgetConfig['widget-data-format'] || {};
  const imageSize = (format as any).imageSize || 80;
  const nameColor = (format as any).nameColor || 'var(--owt-color-primary-dark, #F07B1A)';
  const showIdLabel = (format as any).showIdLabel !== false; // Default to true

  // Generate a unique class ID for this widget instance
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
        {/* Avatar/Image */}
        <div className="profile-avatar-container">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayName || 'Profile'}
              className="profile-avatar"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
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
              alt="Profile Placeholder"
            />
          </div>
        </div>

        {/* Name and ID Container */}
        <div className="profile-info">
          {/* Display Name */}
          {displayName && (
            <div className="profile-name">
              {displayName}
            </div>
          )}

          {/* ID */}
          {idValue && (
            <div className="profile-id">
              {showIdLabel && (
                <span className="profile-id-label">ID :</span>
              )}
              <span className="profile-id-value">{idValue}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

