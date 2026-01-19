/**
 * Chat UI Components for json-render
 * React components that render the catalog elements
 */

import React from 'react';
import { useData, type ComponentRenderProps, type ComponentRegistry } from '@json-render/react';

// Format value based on format type
function formatValue(value: unknown, format?: string): string {
    if (value === undefined || value === null) return '—';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
        case 'percent':
            return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(Number(value));
        case 'number':
            return new Intl.NumberFormat('en-US').format(Number(value));
        case 'date':
            return new Date(String(value)).toLocaleDateString();
        default:
            return String(value);
    }
}

// Shared styles
const styles = {
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '16px',
    } as React.CSSProperties,
    title: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'rgba(248, 250, 252, 0.7)',
        marginBottom: '4px',
    } as React.CSSProperties,
    value: {
        fontSize: '24px',
        fontWeight: 600,
        color: '#f8fafc',
    } as React.CSSProperties,
    subtitle: {
        fontSize: '11px',
        color: 'rgba(248, 250, 252, 0.5)',
        marginTop: '4px',
    } as React.CSSProperties,
};

const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#8b5cf6',
    orange: '#f59e0b',
    red: '#ef4444',
};

// Components
export const Metric: React.FC<ComponentRenderProps> = ({ element }) => {
    const { get } = useData();
    const props = element.props as { label: string; valuePath: string; format?: string; trend?: string };
    const value = get(props.valuePath);
    const formattedValue = formatValue(value, props.format);

    const trendColors: Record<string, string> = {
        up: '#10b981',
        down: '#ef4444',
        neutral: 'rgba(248, 250, 252, 0.5)',
    };

    const trendIcons: Record<string, string> = {
        up: '↑',
        down: '↓',
        neutral: '→',
    };

    return (
        <div style={styles.card}>
            <div style={styles.title}>{props.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={styles.value}>{formattedValue}</span>
                {props.trend && (
                    <span style={{ color: trendColors[props.trend], fontSize: '14px' }}>
                        {trendIcons[props.trend]}
                    </span>
                )}
            </div>
        </div>
    );
};

export const StatCard: React.FC<ComponentRenderProps> = ({ element }) => {
    const { get } = useData();
    const props = element.props as { title: string; valuePath: string; subtitle?: string; icon?: string; color?: string };
    const value = get(props.valuePath);
    const color = props.color ? colorMap[props.color] : colorMap.blue;

    return (
        <div style={{
            ...styles.card,
            borderLeft: `3px solid ${color}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <div style={styles.title}>{props.title}</div>
                    <div style={styles.value}>{formatValue(value, 'number')}</div>
                    {props.subtitle && (
                        <div style={styles.subtitle}>{props.subtitle}</div>
                    )}
                </div>
                {props.icon && (
                    <div style={{ fontSize: '24px', opacity: 0.6 }}>{props.icon}</div>
                )}
            </div>
        </div>
    );
};

export const Table: React.FC<ComponentRenderProps> = ({ element }) => {
    const { get } = useData();
    const props = element.props as { dataPath: string; columns: Array<{ key: string; label: string; format?: string }>; maxRows?: number };
    const items = get(props.dataPath) as Array<Record<string, unknown>> | undefined;

    if (!items || !Array.isArray(items)) {
        return <div style={{ color: 'rgba(248, 250, 252, 0.5)', fontSize: '13px' }}>No data available</div>;
    }

    const displayItems = props.maxRows ? items.slice(0, props.maxRows) : items;

    return (
        <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                        {props.columns.map((col, i) => (
                            <th key={i} style={{
                                padding: '10px 12px',
                                textAlign: 'left',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'rgba(248, 250, 252, 0.6)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                            }}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayItems.map((item, rowIdx) => (
                        <tr key={rowIdx} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            {props.columns.map((col, colIdx) => (
                                <td key={colIdx} style={{
                                    padding: '10px 12px',
                                    fontSize: '13px',
                                    color: '#f8fafc',
                                }}>
                                    {formatValue(item[col.key], col.format)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const List: React.FC<ComponentRenderProps> = ({ element }) => {
    const { get } = useData();
    const props = element.props as { dataPath: string; titlePath: string; subtitlePath?: string; maxItems?: number };
    const items = get(props.dataPath) as Array<Record<string, unknown>> | undefined;

    if (!items || !Array.isArray(items)) {
        return <div style={{ color: 'rgba(248, 250, 252, 0.5)', fontSize: '13px' }}>No data available</div>;
    }

    const displayItems = props.maxItems ? items.slice(0, props.maxItems) : items;

    // Helper to resolve local path within an item
    const getFromItem = (obj: any, path: string) => {
        const parts = path.replace(/^\//, '').split('/');
        let current = obj;
        for (const part of parts) {
            if (current && typeof current === 'object') current = current[part];
            else return undefined;
        }
        return current;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayItems.map((item, idx) => {
                const title = getFromItem(item, props.titlePath);
                const subtitle = props.subtitlePath ? getFromItem(item, props.subtitlePath) : undefined;

                return (
                    <div key={idx} style={{
                        ...styles.card,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: colorMap.blue,
                            flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 500 }}>
                                {String(title || '—')}
                            </div>
                            {subtitle !== undefined && (
                                <div style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.5)', marginTop: '2px' }}>
                                    {String(subtitle)}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const Chart: React.FC<ComponentRenderProps> = ({ element }) => {
    const { get } = useData();
    const props = element.props as { type: string; dataPath: string; xKey: string; yKey: string; title?: string };
    const items = get(props.dataPath) as Array<Record<string, unknown>> | undefined;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return <div style={{ color: 'rgba(248, 250, 252, 0.5)', fontSize: '13px' }}>No data available</div>;
    }

    // Simple bar chart visualization
    const maxValue = Math.max(...items.map(item => Number(item[props.yKey]) || 0));

    return (
        <div style={styles.card}>
            {props.title && (
                <div style={{ ...styles.title, marginBottom: '12px' }}>{props.title}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100px' }}>
                {items.slice(0, 10).map((item, idx) => {
                    const value = Number(item[props.yKey]) || 0;
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;

                    return (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{
                                width: '100%',
                                height: `${height}%`,
                                minHeight: '4px',
                                background: `linear-gradient(180deg, ${colorMap.blue} 0%, ${colorMap.purple} 100%)`,
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.3s ease',
                            }} />
                            <div style={{ fontSize: '9px', color: 'rgba(248, 250, 252, 0.4)', textAlign: 'center' }}>
                                {String(item[props.xKey] || '').slice(0, 3)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const Card: React.FC<ComponentRenderProps> = ({ element, children }) => {
    const props = element.props as { title?: string; subtitle?: string };

    return (
        <div style={styles.card}>
            {props.title && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                        {props.title}
                    </div>
                    {props.subtitle && (
                        <div style={styles.subtitle}>{props.subtitle}</div>
                    )}
                </div>
            )}
            {children}
        </div>
    );
};

export const Grid: React.FC<ComponentRenderProps> = ({ element, children }) => {
    const props = element.props as { columns?: number; gap?: string };
    const columns = props.columns || 2;
    const gapMap: Record<string, string> = { sm: '8px', md: '12px', lg: '16px' };
    const gap = gapMap[props.gap || 'md'];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap,
        }}>
            {children}
        </div>
    );
};

export const Section: React.FC<ComponentRenderProps> = ({ element, children }) => {
    const props = element.props as { title?: string };

    return (
        <div style={{ marginBottom: '16px' }}>
            {props.title && (
                <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'rgba(248, 250, 252, 0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                }}>
                    {props.title}
                </div>
            )}
            {children}
        </div>
    );
};

export const Button: React.FC<ComponentRenderProps> = ({ element }) => {
    const props = element.props as { label: string; variant?: string };

    const variantStyles: Record<string, React.CSSProperties> = {
        primary: {
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: 'white',
            border: 'none',
        },
        secondary: {
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        },
        ghost: {
            background: 'transparent',
            color: 'rgba(248, 250, 252, 0.7)',
            border: 'none',
        },
    };

    const variant = props.variant || 'secondary';

    return (
        <button style={{
            ...variantStyles[variant],
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
        }}>
            {props.label}
        </button>
    );
};

// Component registry for json-render
export const chatUIRegistry: ComponentRegistry = {
    Metric: Metric as any,
    StatCard: StatCard as any,
    Table: Table as any,
    List: List as any,
    Chart: Chart as any,
    Card: Card as any,
    Grid: Grid as any,
    Section: Section as any,
    Button: Button as any,
};

export type ChatUIRegistry = typeof chatUIRegistry;
