import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList
} from "recharts";
import { Paper, Typography } from "@mui/material";



function BarChartCard({ title, data, color = "#235789", layout = "horizontal", showPercent = false,  
wrapLabels = false, barSize = 35,  percentFontSize = 12, labelFontSize = 10, showValues = false
 }) {
  const isVertical = layout === "vertical";

  const total = data.reduce((sum, item) => sum + item.value, 0);

const chartData = data.map(item => ({
  ...item,
  percent: total > 0
    ? Math.round((item.value / total) * 100)
    : 0
}));
  return (
    <Paper className="chart-card" elevation={0}>
      <Typography variant="subtitle1" fontWeight={600} className="chart-title">
        {title}
      </Typography>
      <div className={isVertical ? "bar-chart tall" : "bar-chart"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout={isVertical ? "vertical" : "horizontal"} 
          margin={{ top: 30, right: 16, left: isVertical ? 48 : 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ec" />
               {isVertical ? (
  <>
    <XAxis type="number" allowDecimals={false} />
    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
  </>
) : (
  <>
    {wrapLabels ? (
      <XAxis
        dataKey="name"
        interval={0}
        height={60}
        tick={({ x, y, payload }) => {

          const words = payload.value
  .replaceAll("/", " / ")
  .replaceAll("-", "- ")
  .split(" ");

          return (
            <g transform={`translate(${x},${y + 12})`}>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fill="#666"
                fontSize={10}
              >
                {words.map((word, index) => (
                  <tspan
                    key={index}
                    x="0"
                    dy={index === 0 ? 0 : 10}
                  >
                    {word}
                  </tspan>
                ))}
              </text>
            </g>
          );
        }}
      />
    ) : (
      <XAxis
        dataKey="name"
        interval={0}
        tick={{ fontSize: labelFontSize }}
        height={60}
      />
    )}

    <YAxis hide />
  </>
)}
            <Tooltip formatter={(value) => [value, "Calls"]} />
          
          <Bar
  dataKey="value"
  fill={color}
  radius={[6, 6, 0, 0]}
  barSize={barSize}
>
  {showValues && (
    <LabelList
      dataKey="value"
      position="center"
      formatter={(value) => value.toLocaleString()}
      style={{
        fill: "#fff",
        fontWeight: 500,
        fontSize: 10
      }}
    />
  )}

  <LabelList
    dataKey="percent"
    position="top"
    formatter={(value) => `${value}%`}
    style={{
      fill: "#000",
      fontWeight: 700,
      fontSize: percentFontSize
    }}
  />
</Bar>
  

          </BarChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}

export default BarChartCard;
