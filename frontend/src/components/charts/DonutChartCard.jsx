import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Paper, Typography } from "@mui/material";

const colors = ["#235789", "#2f9c95", "#d8892f", "#c44949", "#6f7c8a", "#8a5d3b", "#2f7d4f", "#7b68a6"];

function DonutChartCard({ title, data }) {
  return (
    <Paper className="chart-card" elevation={0}>
      <Typography variant="subtitle1" fontWeight={600} className="chart-title">
        {title}
      </Typography>
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
         
<Pie
  data={data}
  dataKey="value"
  nameKey="name"
  innerRadius="50"
  outerRadius="90"
  paddingAngle={2}
 labelLine={({ percent }) => percent * 100 >= 1}
  
label={({ name, percent, cx, cy, midAngle, outerRadius, index }) => {
  const pct = percent * 100;

  if (pct < 1) return null;

  const RADIAN = Math.PI / 180;

  const x = cx + (outerRadius + 12) * Math.cos(-midAngle * RADIAN);
  const y = cy + (outerRadius + 12) * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill={colors[index % colors.length]}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {`${name} ${pct.toFixed(0)}%`}
    </text>
  );
}}

>
  {data.map((entry, index) => (
    <Cell
      key={entry.name}
      fill={colors[index % colors.length]}
    />
  ))}
</Pie>

            <Tooltip
  formatter={(value, name, props) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const percent = ((value / total) * 100).toFixed(2);

    return [`${value} Calls (${percent}%)`, name];
  }}
/>
            <Legend
  verticalAlign="bottom"
  align="center"
  iconType="circle"
  iconSize={8}
  wrapperStyle={{
    fontSize: 8,
    paddingTop: "10px"
  }}
/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}

export default DonutChartCard;
