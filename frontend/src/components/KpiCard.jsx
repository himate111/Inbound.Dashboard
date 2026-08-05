import { Box, Paper, Typography } from "@mui/material";

const toneMap = {
  primary: "#235789",
  secondary: "#2f9c95",
  success: "#2f7d4f",
  error: "#c44949",
  warning: "#d8892f",
  neutral: "#5d6875"
};

function KpiCard({ label, value, tone = "neutral" }) {
  return (
    <Paper className="kpi-card" elevation={0}>
      <Box className="kpi-accent" sx={{ backgroundColor: toneMap[tone] || toneMap.neutral }} />
      <Typography variant="body2" color="text.secondary" className="kpi-label">
        {label}
      </Typography>
      <Typography
          sx={{
            fontSize: "1.2rem",
            fontWeight: 500,
            lineHeight: 1.2
          }}
          className="kpi-value"
        >
          {value}
        </Typography>
    </Paper>
  );
}

export default KpiCard;
