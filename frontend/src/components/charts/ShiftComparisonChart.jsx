import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LabelList
} from "recharts";
import { Paper, Typography } from "@mui/material";

function ShiftComparisonChart({ title, data }) {



  const chartData = data.map(item => {
  const total = item.connected + item.abandoned;

  return {
    ...item,
    connectedPct:
      total > 0
        ? Math.round((item.connected / total) * 100)
        : 0,
    abandonedPct:
      total > 0
        ? Math.round((item.abandoned / total) * 100)
        : 0
  };
});

  return (
    <Paper className="chart-card" elevation={0}>
      <Typography
        variant="subtitle1"
        fontWeight={600}
        className="chart-title"
      >
        {title}
      </Typography>

      <div className="bar-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 30,
              right: 20,
              left: 0,
              bottom: 10
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="name" fontSize={11} padding = {{ left: 10, right: 10 }} />

           <YAxis
              hide
              scale="log"
              domain={[1, "auto"]}
            />

            <Tooltip
  formatter={(value) => [value.toLocaleString(), "Calls"]}
/>

            <Legend />

           <Bar
  dataKey="connected"
  fill="#2f7d4f"
  name="Connected"
  barSize={35}
  radius={[6, 6, 0, 0]}
>
  <LabelList
    dataKey="connected"
    position="center"
    formatter={(v) => v.toLocaleString()}
    style={{
      fill: "#fff",
      fontWeight: 700,
      fontSize: 8
    }}
  />

  <LabelList
    dataKey="connectedPct"
    position="top"
    formatter={(v) => `${v}%`}
    style={{
      fill: "#000",
      fontWeight: 700,
      fontSize: 11
    }}
  />
</Bar>

            <Bar
  dataKey="abandoned"
   minPointSize={12}
  fill="#6b7280"
  name="Abandoned"
  barSize={35}
  radius={[6, 6, 0, 0]}
>
  <LabelList
    dataKey="abandoned"
    position="center"
    formatter={(v) => v.toLocaleString()}
    style={{
      fill: "#fff",
      fontWeight: 700,
      fontSize: 9
    }}
  />

  <LabelList
    dataKey="abandonedPct"
    position="top"
    formatter={(v) => `${v}%`}
    style={{
      fill: "#000",
      fontWeight: 700,
      fontSize: 11
    }}
  />
</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}

export default ShiftComparisonChart;