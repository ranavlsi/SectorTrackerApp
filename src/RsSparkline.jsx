import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function RsSparkline({ data, status }) {
    if (!data || data.length === 0) return null;
    
    const chartData = data.map((val, i) => ({ value: val, index: i }));
    
    let color = '#4a6080'; // Grey for none
    if (status === 'c_and_h') color = '#c47aff'; // Purple for full Cup & Handle
    else if (status === 'cup') color = '#f59e0b'; // Amber for forming cup
    
    return (
        <div style={{ width: '120px', height: '40px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <YAxis domain={['auto', 'auto']} hide />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={2} 
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
