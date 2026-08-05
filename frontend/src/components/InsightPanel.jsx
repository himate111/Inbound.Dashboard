import { Box, Paper, Typography } from "@mui/material";

function InsightBlock({ title, items }) {
  return (
    <Box className="insight-block">
      <Typography variant="subtitle1" fontWeight={850}>
        {title}
      </Typography>
      <Box component="ul" className="insight-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </Box>
    </Box>
  );
}

function InsightPanel({ summary }) {
  return (
    <Paper className="insight-panel" elevation={0}>
      <Typography variant="h6" fontWeight={900}>
        Executive Summary
      </Typography>
      <InsightBlock title="Insights" items={summary.executive || []} />
      <InsightBlock title="Performance Issues" items={summary.issues || []} />
      <InsightBlock title="Recommendations" items={summary.recommendations || []} />
    </Paper>
  );
}

export default InsightPanel;
