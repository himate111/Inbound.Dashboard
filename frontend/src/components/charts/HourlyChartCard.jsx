import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList
} from "recharts";

import { Paper, Typography } from "@mui/material";

function HourlyChartCard({ title, data, metric, color = "#235789", unit = "", minValueLabel = 0,minPercentLabel = 0 , lineColor = "#111827", }) {
  const isRate = unit === "%";

  

const filteredData = data;

const total = filteredData.reduce(
  (sum, item) => sum + (Number(item[metric]) || 0),
  0
);

const chartData = filteredData.map(item => ({
  ...item,
  percent:
    total > 0
      ? Math.round((item[metric] / total) * 100)
      : 0
}));

  return (
    <Paper className="chart-card" elevation={0}>
      <Typography variant="subtitle1" fontWeight={850} className="chart-title">
        {title}
      </Typography>
      <div className="hourly-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ec" />
            <XAxis
  dataKey="label"
  tickFormatter={(value) => Number(value.split(":")[0])}
   
  tick={{ fontSize: 11 }}
/>
            {/* <YAxis allowDecimals={false} unit={unit} /> */}
            <YAxis hide />
            <Tooltip formatter={(value) => [`${value}${unit}`, isRate ? "Drop Rate" : "Calls"]} />
           <Line
  type="monotone"
  dataKey={metric}
  stroke={lineColor}
  strokeWidth={3}
  dot={false}
/>
            
           <Bar
  dataKey={metric}
  fill={color}
  radius={[5, 5, 0, 0]}
>


  <LabelList
    dataKey={metric}
    position="center"
    formatter={(value) => value.toLocaleString()}
    style={{
      fill: "#ffffff",
      fontSize: 7,
      fontWeight: 700
    }}
  />


  {/* Call count inside bar */}
 <LabelList
  dataKey="percent"
  position="top"
  formatter={(value) =>
    Number(value) > minPercentLabel
      ? `${value}%`
      : ""
  }
  style={{
    fill: "#000",
    fontSize: 8,
    fontWeight: 600
  }}
/>

  {/* Percentage above bar */}
 {/* <LabelList
  dataKey="percent"
  position="top"
  content={(props) => {
  const { x, y, value, payload } = props;

  if (Number(payload?.[metric]) <= minPercentLabel) {
    return null;
  }

  return (
    <text
      x={x}
      y={y - 5}
      textAnchor="top"
      fill="#000"
      fontSize={8}
      fontWeight={600}
    >
      {value}%
    </text>
  );
}}
  
  style={{
    fill: "#000000",
    fontSize: 8,
    fontWeight: 600
  }}
/> */}
</Bar>

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}

export default HourlyChartCard;
