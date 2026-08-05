import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LabelList
} from "recharts";

import { Paper, Typography } from "@mui/material";

function MonthlyStackedChart({ title, data }) {
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
  data={data}
  barSize={35}
  barCategoryGap="15%"
>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
  dataKey="month"
  interval={0}
  tick={{
    fontSize: 12,
    fill: "#4b5563"
  }}
/>

            <YAxis
            hide
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />

            <Tooltip />

            <Legend
  iconSize={10}
  wrapperStyle={{
    fontSize: "12px",
    paddingTop: "10px"
  }}
/>

            <Bar
              dataKey="connected"
              stackId="a"
              fill="#2f7d4f"
              name="Connected"
            >
              <LabelList
                dataKey="connected"
                position="center"
                formatter={(v) => `${v}%`}
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fill: "#fff"
                }}
                />
            </Bar>

            <Bar
              dataKey="abandoned"
              stackId="a"
              fill="#6b7280"
              name="Abandoned"
            >
              <LabelList
                dataKey="abandoned"
                position="center"
                formatter={(v) => `${v}%`}
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fill: "#fff"
                }}
                />
            </Bar>

            <Bar
              dataKey="others"
              stackId="a"
              fill="#235789"
              name="Others"
            >
              <LabelList
                dataKey="others"
                position="center"
                formatter={(v) => `${v}%`}
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    fill: "#fff"
                }}
                />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Paper>
  );
}

export default MonthlyStackedChart;