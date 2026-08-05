import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";

function AgentTable({ title, rows }) {
  return (
    <Paper className="chart-card" elevation={0}>
      <Typography variant="subtitle1" fontWeight={850} className="chart-title">
        {title}
      </Typography>
      <TableContainer className="agent-table-wrap">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Connected</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Avg Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.agent}>
                  <TableCell>{row.agent}</TableCell>
                  <TableCell align="right">{row.totalCalls.toLocaleString()}</TableCell>
                  <TableCell align="right">{row.connectedCalls.toLocaleString()}</TableCell>
                  <TableCell align="right">{row.connectionRate}%</TableCell>
                  <TableCell align="right">{row.avgAgentDuration}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No agent records
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default AgentTable;
