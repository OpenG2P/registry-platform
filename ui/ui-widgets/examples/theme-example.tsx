/**
 * Theme Customisation Example
 *
 * Demonstrates how a host application can supply a `theme` prop to
 * `<WidgetProvider>` to override the default colours and styles used
 * across sections, panels, widgets, and buttons.
 *
 * Features shown:
 * - Three preset colour palettes switchable at runtime
 * - All major theme tokens (colors, section, panel, button, widget)
 * - Both RegistryView and IntakeForm modes
 * - Access to the resolved theme via `useWidgetTheme()` hook
 */

import React, { useCallback, useMemo, useState } from 'react';
import { createWidgetStore } from '../src/store';
import {
  WidgetProvider,
  SectionsContainer,
  useWidgetTheme,
} from '../src';
import { defaultTheme } from '../src/theme';
import type { WidgetTheme } from '../src/theme';
import type { SectionChanges } from '../src/components/SectionRenderer';
import type { SectionMode } from '../src/components/SectionsContainer';
import { themeSections, THEME_REGISTER_ID } from './shared/exampleSchemas';
import { themeSampleData } from './shared/exampleData';

// ─────────────────────────────────────────────────────────────────
// Theme presets
// ─────────────────────────────────────────────────────────────────

/**
 * Brand palette:
 *   Gold    #F5BB1A   Orange  #F07B1A   Purple  #88498F
 *   Grey    #C4C4C4   Navy    #011627   LtGrey  #F6F6F6
 *
 * Shade-table reference (0% = base):
 *   Gold   +87.5% #FEF7E3  +62.5% #FBE6AA  +25% #F6CE54  -25% #C1930A  -50% #806207
 *   Orange +87.5% #FDEEE3  +62.5% #F9CDAB  +25% #F29B58  -25% #BD5A0E  -50% #7E3C09
 *   Grey   +62.5% #E4E4E4  +25% #C9CACA   -25% #898B8B  -37.5% #727474
 *   LtGrey +50%   #FCFCFC  -12.5% #DBDBDB  -25% #BBBBBB
 */
const themes: Record<string, { label: string; description: string; theme: WidgetTheme }> = {
  default: {
    label: 'Default (Gold)',
    description: 'Built-in OpenG2P branding — Gold primary with Orange accent.',
    theme: {},
  },

  orange: {
    label: 'Orange',
    description: 'Orange-led palette with Gold highlights.',
    theme: {
      colors: {
        primary: '#F07B1A',
        primaryDark: '#BD5A0E',
        primaryLight: '#FDEEE3',
        primaryAccent: '#F5BB1A',
        success: '#16A34A',
        successDark: '#047857',
        successLight: '#D1FAE5',
        error: '#B91C1C',
        errorLight: '#FEE2E2',
        warning: '#F59E0B',
        info: '#2563EB',
      },
      section: {
        dividerColor: '#F07B1A',
      },
      button: {
        primaryBorder: '#F07B1A',
        primaryBg: '#FDEEE3',
        primaryColor: '#011627',
      },
      widget: {
        inputFocusBorderColor: '#F07B1A',
      },
    },
  },

  purple: {
    label: 'Purple',
    description: 'Purple accent for social protection dashboards with Gold highlights.',
    theme: {
      colors: {
        primary: '#88498F',
        primaryDark: '#66376B',
        primaryLight: '#E2D2E3',
        primaryAccent: '#F5BB1A',
        success: '#2D8659',
        successDark: '#1B6B42',
        successLight: '#D4EDDA',
        error: '#A4243B',
        errorLight: '#F8D7DA',
        warning: '#D4A017',
        info: '#5B4F9E',
      },
      section: {
        dividerColor: '#88498F',
      },
      panel: {
        dividerColor: '#C4C4C4',
      },
      button: {
        primaryBorder: '#88498F',
        primaryBg: '#F6F6F6',
        primaryColor: '#011627',
      },
      widget: {
        inputFocusBorderColor: '#88498F',
      },
    },
  },
};

const sampleData = themeSampleData(THEME_REGISTER_ID);

// ─────────────────────────────────────────────────────────────────
// Small helper component that reads the resolved theme from context
// ─────────────────────────────────────────────────────────────────

const ActiveThemeInfo = () => {
  const theme = useWidgetTheme();
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontFamily: 'monospace',
        backgroundColor: theme.colors.primaryLight,
        border: `1px solid ${theme.colors.primary}`,
        color: theme.colors.text,
        lineHeight: 1.6,
      }}
    >
      <strong>Resolved theme tokens (via useWidgetTheme)</strong>
      <br />
      primary: {theme.colors.primary} &nbsp;|&nbsp;
      primaryDark: {theme.colors.primaryDark} &nbsp;|&nbsp;
      primaryLight: {theme.colors.primaryLight}
      <br />
      section.dividerColor: {theme.section.dividerColor} &nbsp;|&nbsp;
      button.primaryBorder: {theme.button.primaryBorder} &nbsp;|&nbsp;
      widget.inputFocusBorderColor: {theme.widget.inputFocusBorderColor}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Interactive colour picker field
// ─────────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'monospace',
  color: '#011627',
  minWidth: '140px',
};

const pickerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '1px solid #C4C4C4',
  borderRadius: '4px',
  padding: 0,
  cursor: 'pointer',
  backgroundColor: 'transparent',
};

const hexInputStyle: React.CSSProperties = {
  width: '80px',
  fontSize: '12px',
  fontFamily: 'monospace',
  padding: '4px 6px',
  border: '1px solid #E4E4E4',
  borderRadius: '4px',
};

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div style={fieldStyle}>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={pickerStyle}
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={hexInputStyle}
      spellCheck={false}
    />
    <span style={labelStyle}>{label}</span>
  </div>
);

const TextInputField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div style={fieldStyle}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...hexInputStyle, width: '110px' }}
      spellCheck={false}
    />
    <span style={labelStyle}>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// Live theme editor panel
// ─────────────────────────────────────────────────────────────────

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#727474',
  margin: '12px 0 6px',
  paddingBottom: '4px',
  borderBottom: '1px solid #E4E4E4',
};

type ResolvedTheme = typeof defaultTheme;

interface ThemeEditorProps {
  value: ResolvedTheme;
  onChange: (updated: ResolvedTheme) => void;
}

const ThemeEditor = ({ value, onChange }: ThemeEditorProps) => {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = useCallback(
    <S extends keyof ResolvedTheme>(
      section: S,
      key: keyof ResolvedTheme[S],
      v: string,
    ) => {
      onChange({
        ...value,
        [section]: { ...value[section], [key]: v },
      });
    },
    [value, onChange],
  );

  const themeJson = useMemo(() => JSON.stringify(value, null, 2), [value]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(themeJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [themeJson]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Colour pickers grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px 24px',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #E4E4E4',
          backgroundColor: '#F6F6F6',
          maxHeight: '560px',
          overflowY: 'auto',
        }}
      >
        {/* Colors */}
        <div>
          <div style={sectionHeaderStyle}>Colors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ColorField label="primary" value={value.colors.primary} onChange={(v) => set('colors', 'primary', v)} />
            <ColorField label="primaryDark" value={value.colors.primaryDark} onChange={(v) => set('colors', 'primaryDark', v)} />
            <ColorField label="primaryLight" value={value.colors.primaryLight} onChange={(v) => set('colors', 'primaryLight', v)} />
            <ColorField label="primaryAccent" value={value.colors.primaryAccent} onChange={(v) => set('colors', 'primaryAccent', v)} />
            <ColorField label="border" value={value.colors.border} onChange={(v) => set('colors', 'border', v)} />
            <ColorField label="borderLight" value={value.colors.borderLight} onChange={(v) => set('colors', 'borderLight', v)} />
            <ColorField label="background" value={value.colors.background} onChange={(v) => set('colors', 'background', v)} />
            <ColorField label="backgroundAlt" value={value.colors.backgroundAlt} onChange={(v) => set('colors', 'backgroundAlt', v)} />
            <ColorField label="text" value={value.colors.text} onChange={(v) => set('colors', 'text', v)} />
            <ColorField label="textMuted" value={value.colors.textMuted} onChange={(v) => set('colors', 'textMuted', v)} />
            <ColorField label="success" value={value.colors.success} onChange={(v) => set('colors', 'success', v)} />
            <ColorField label="successDark" value={value.colors.successDark} onChange={(v) => set('colors', 'successDark', v)} />
            <ColorField label="successLight" value={value.colors.successLight} onChange={(v) => set('colors', 'successLight', v)} />
            <ColorField label="error" value={value.colors.error} onChange={(v) => set('colors', 'error', v)} />
            <ColorField label="errorLight" value={value.colors.errorLight} onChange={(v) => set('colors', 'errorLight', v)} />
            <ColorField label="warning" value={value.colors.warning} onChange={(v) => set('colors', 'warning', v)} />
            <ColorField label="info" value={value.colors.info} onChange={(v) => set('colors', 'info', v)} />
          </div>
        </div>

        {/* Section */}
        <div>
          <div style={sectionHeaderStyle}>Section</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ColorField label="dividerColor" value={value.section.dividerColor} onChange={(v) => set('section', 'dividerColor', v)} />
            <ColorField label="borderColor" value={value.section.borderColor} onChange={(v) => set('section', 'borderColor', v)} />
            <ColorField label="backgroundColor" value={value.section.backgroundColor} onChange={(v) => set('section', 'backgroundColor', v)} />
            <ColorField label="titleColor" value={value.section.titleColor} onChange={(v) => set('section', 'titleColor', v)} />
            <TextInputField label="borderRadius" value={value.section.borderRadius} onChange={(v) => set('section', 'borderRadius', v)} />
          </div>

          <div style={sectionHeaderStyle}>Panel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ColorField label="dividerColor" value={value.panel.dividerColor} onChange={(v) => set('panel', 'dividerColor', v)} />
            <ColorField label="backgroundColor" value={value.panel.backgroundColor} onChange={(v) => set('panel', 'backgroundColor', v)} />
          </div>
        </div>

        {/* Button + Widget */}
        <div>
          <div style={sectionHeaderStyle}>Button</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ColorField label="primaryBorder" value={value.button.primaryBorder} onChange={(v) => set('button', 'primaryBorder', v)} />
            <ColorField label="primaryBg" value={value.button.primaryBg} onChange={(v) => set('button', 'primaryBg', v)} />
            <ColorField label="primaryColor" value={value.button.primaryColor} onChange={(v) => set('button', 'primaryColor', v)} />
            <ColorField label="secondaryBorder" value={value.button.secondaryBorder} onChange={(v) => set('button', 'secondaryBorder', v)} />
            <ColorField label="secondaryBg" value={value.button.secondaryBg} onChange={(v) => set('button', 'secondaryBg', v)} />
            <ColorField label="secondaryColor" value={value.button.secondaryColor} onChange={(v) => set('button', 'secondaryColor', v)} />
            <TextInputField label="borderRadius" value={value.button.borderRadius} onChange={(v) => set('button', 'borderRadius', v)} />
          </div>

          <div style={sectionHeaderStyle}>Widget</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <ColorField label="labelColor" value={value.widget.labelColor} onChange={(v) => set('widget', 'labelColor', v)} />
            <ColorField label="inputBorderColor" value={value.widget.inputBorderColor} onChange={(v) => set('widget', 'inputBorderColor', v)} />
            <ColorField label="inputFocusBorder" value={value.widget.inputFocusBorderColor} onChange={(v) => set('widget', 'inputFocusBorderColor', v)} />
            <ColorField label="inputBackground" value={value.widget.inputBackground} onChange={(v) => set('widget', 'inputBackground', v)} />
            <ColorField label="errorColor" value={value.widget.errorColor} onChange={(v) => set('widget', 'errorColor', v)} />
            <ColorField label="helpTextColor" value={value.widget.helpTextColor} onChange={(v) => set('widget', 'helpTextColor', v)} />

            <div style={{ ...sectionHeaderStyle, marginTop: '16px' }}>Table (widget)</div>
            <ColorField label="tableHeaderBg" value={value.widget.tableHeaderBg} onChange={(v) => set('widget', 'tableHeaderBg', v)} />
            <ColorField label="tableHeaderColor" value={value.widget.tableHeaderColor} onChange={(v) => set('widget', 'tableHeaderColor', v)} />
            <ColorField label="tableBodyBg" value={value.widget.tableBodyBg} onChange={(v) => set('widget', 'tableBodyBg', v)} />
            <ColorField label="tableBorderColor" value={value.widget.tableBorderColor} onChange={(v) => set('widget', 'tableBorderColor', v)} />
            <ColorField label="tableRowDivider" value={value.widget.tableRowDividerColor} onChange={(v) => set('widget', 'tableRowDividerColor', v)} />
            <ColorField label="tableEditingRowBg" value={value.widget.tableEditingRowBg} onChange={(v) => set('widget', 'tableEditingRowBg', v)} />
            <ColorField label="tableDeletedRowBg" value={value.widget.tableDeletedRowBg} onChange={(v) => set('widget', 'tableDeletedRowBg', v)} />
            <ColorField label="tableEmptyText" value={value.widget.tableEmptyTextColor} onChange={(v) => set('widget', 'tableEmptyTextColor', v)} />
            <TextInputField label="tableBorderRadius" value={value.widget.tableBorderRadius} onChange={(v) => set('widget', 'tableBorderRadius', v)} />
          </div>
        </div>
      </div>

      {/* Collapsible JSON viewer */}
      <details
        open={jsonOpen}
        onToggle={(e) => setJsonOpen((e.target as HTMLDetailsElement).open)}
        style={{
          borderRadius: '8px',
          border: '1px solid #E4E4E4',
          backgroundColor: '#F6F6F6',
        }}
      >
        <summary
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            color: '#011627',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '10px' }}>{jsonOpen ? '\u25BC' : '\u25B6'}</span>
          WidgetTheme JSON
          <span style={{ fontWeight: 400, color: '#727474', marginLeft: '4px' }}>
            — paste into your WidgetProvider theme prop
          </span>
        </summary>
        <div style={{ position: 'relative', padding: '0 16px 12px' }}>
          <button
            onClick={handleCopy}
            style={{
              position: 'absolute',
              top: '4px',
              right: '20px',
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid #C4C4C4',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              color: '#011627',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              backgroundColor: '#011627',
              color: '#F6F6F6',
              borderRadius: '6px',
              overflowX: 'auto',
              maxHeight: '400px',
            }}
          >
            {themeJson}
          </pre>
        </div>
      </details>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main example component
// ─────────────────────────────────────────────────────────────────

export const ThemeExample = () => {
  const store = useMemo(() => createWidgetStore(), []);
  const [activeTheme, setActiveTheme] = useState<string>('default');
  const [mode, setMode] = useState<SectionMode>('RegistryView');
  const [customTheme, setCustomTheme] = useState<ResolvedTheme>({ ...defaultTheme });

  const effectiveTheme: WidgetTheme = activeTheme === 'custom' ? customTheme : (themes[activeTheme]?.theme ?? {});
  const description =
    activeTheme === 'custom'
      ? 'Pick any colour below — changes apply instantly.'
      : themes[activeTheme]?.description ?? '';

  const handleSectionSave = async (changes: SectionChanges) => {
    console.log('Section saved:', changes);
    alert(`Section "${changes.section_id}" saved! Check console for payload.`);
  };

  const handleSelectPreset = useCallback((key: string) => {
    setActiveTheme(key);
    if (key !== 'custom' && themes[key]) {
      const preset = themes[key].theme;
      setCustomTheme({
        colors: { ...defaultTheme.colors, ...preset.colors },
        section: { ...defaultTheme.section, ...preset.section },
        panel: { ...defaultTheme.panel, ...preset.panel },
        button: { ...defaultTheme.button, ...preset.button },
        widget: { ...defaultTheme.widget, ...preset.widget },
      });
    }
  }, []);

  const allPresets: { key: string; label: string; swatch: string }[] = [
    ...Object.entries(themes).map(([key, { label, theme }]) => ({
      key,
      label,
      swatch: theme.colors?.primary || '#F5BB1A',
    })),
    { key: 'custom', label: 'Custom', swatch: customTheme.colors.primary },
  ];

  return (
    <WidgetProvider store={store} schemaData={sampleData} theme={effectiveTheme}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
          fontFamily: 'Roboto, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '24px', marginBottom: 0 }}>
          Theme Customisation Example
        </h1>

        {/* ── Theme picker ─────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 500 }}>Theme:</span>
          {allPresets.map(({ key, label, swatch }) => {
            const isActive = key === activeTheme;
            return (
              <button
                key={key}
                onClick={() => handleSelectPreset(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: isActive ? `2px solid ${swatch}` : '1px solid #C4C4C4',
                  background: isActive ? `${swatch}15` : '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: key === 'custom'
                      ? '2px'
                      : '50%',
                    background: key === 'custom'
                      ? `conic-gradient(#F5BB1A, #F07B1A, #88498F, #011627, #C4C4C4, #F5BB1A)`
                      : swatch,
                    flexShrink: 0,
                    border: key === 'custom' ? '1px solid #C4C4C4' : 'none',
                  }}
                />
                {label}
              </button>
            );
          })}
        </div>

        <p style={{ color: '#727474', margin: 0, fontSize: '14px' }}>
          {description}
        </p>

        {/* ── Custom theme editor (visible only when "Custom" is selected) */}
        {activeTheme === 'custom' && (
          <ThemeEditor value={customTheme} onChange={setCustomTheme} />
        )}

        {/* ── Mode switcher ────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>Mode:</span>
          {(['RegistryView', 'IntakeForm'] as SectionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: m === mode ? '2px solid #011627' : '1px solid #C4C4C4',
                background: m === mode ? '#F6F6F6' : '#FFFFFF',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: m === mode ? 600 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* ── Resolved theme readout ───────────────────────────── */}
        <ActiveThemeInfo />

        {/* ── Sections ─────────────────────────────────────────── */}
        <SectionsContainer
          sections={themeSections}
          schemaData={sampleData}
          mode={mode}
          onSectionSave={handleSectionSave}
        />
      </div>
    </WidgetProvider>
  );
};

export default ThemeExample;
