import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Snackbar,
  Toolbar,
  Typography
} from "@mui/material";
import MonthlyStackedChart from "./components/charts/MonthlyStackedChart.jsx";
import RefreshIconModule from "@mui/icons-material/Refresh";
import FilterBar from "./components/FilterBar.jsx";
import KpiCard from "./components/KpiCard.jsx";
import InsightPanel from "./components/InsightPanel.jsx";
import DonutChartCard from "./components/charts/DonutChartCard.jsx";
import BarChartCard from "./components/charts/BarChartCard.jsx";
import HourlyChartCard from "./components/charts/HourlyChartCard.jsx";
import AgentTable from "./components/AgentTable.jsx";
import ShiftComparisonChart from "./components/charts/ShiftComparisonChart.jsx";
import { fetchDashboard, fetchFilters } from "./services/api.js";
import { useRef } from "react";
import FileUploadIconModule from "@mui/icons-material/FileUpload";
import { uploadCsv } from "./services/api.js";


const FileUploadIcon =
  FileUploadIconModule.default || FileUploadIconModule;

const RefreshIcon = RefreshIconModule.default || RefreshIconModule;

const emptyDashboard = {
  kpis: {
    totalCalls: 0,
    connectedCalls: 0,
    notConnectedCalls: 0,
    connectionRate: 0,
    notConnectedPercentage: 0,
    avgCallDuration: "0s",
    avgAgentDuration: "0s",
    avgQueueDuration: "0s"
  },
  charts: {
    callEnd: [],
    dispositions: [],
    groups: [],
    shifts: [],
    connectedByShift: [],
    notConnectedByShift: [],
    topSubDispositions: [],
    topAgents: [],
    bottomAgents: [],
    hourly: [],
    callsByYear: [],
callsByMonth: []
  },
  agentAnalytics: {
    topAgents: [],
    bottomAgents: []
  },
  summary: {
    executive: [],
    issues: [],
    recommendations: []
  }
};

const defaultFilters = {
  year: [],
  month: [],
  startDate: "",
  endDate: "",
  groupName: [],
  agent: [],
  disposition: [],
  subDisposition: [],
  shift: []
};

function App() {
  
  const [filters, setFilters] = useState(defaultFilters);
  const [filterOptions, setFilterOptions] = useState({
    years: [],
    months: [],
    groups: [],
    agents: [],
    dispositions: [],
    subDispositions: [],
    shifts: []
  });
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fileInputRef = useRef(null);
const [uploading, setUploading] = useState(false);

  const loadFilters = useCallback(async () => {
    const values = await fetchFilters();
    setFilterOptions(values);
  }, []);



const handleUpload = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  setUploading(true);

  try {
    const result = await uploadCsv(file);

    await loadFilters();
    await loadDashboard();

    setToast({
      severity: "success",
      message: `Upload complete: ${result.insertedRows} inserted, ${result.skippedRows} skipped, ${result.failedRows} failed.`
    });
  } catch (error) {
    setToast({
      severity: "error",
      message:
        error.response?.data?.message || "CSV upload failed."
    });
  } finally {
    setUploading(false);
    event.target.value = "";
  }
};


  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDashboard(filters);
      setDashboard(data);
    } catch (error) {
      setToast({
        severity: "error",
        message: error.response?.data?.message || "Unable to load dashboard data."
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilters().catch((error) => {
      setToast({
        severity: "error",
        message: error.response?.data?.message || "Unable to load filter values."
      });
    });
  }, [loadFilters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpis = dashboard.kpis || emptyDashboard.kpis;
  const charts = dashboard.charts || emptyDashboard.charts;
  const agentAnalytics = dashboard.agentAnalytics || emptyDashboard.agentAnalytics;
  const summary = dashboard.summary || emptyDashboard.summary;

  const topSubDispositionData = charts.topSubDispositions.map(item => ({
  ...item,
  name:
    item.name === "Call Disconnected in between Conversation"
      ? "Disconnected"
      : item.name
}));

  const kpiCards = useMemo(
  () => [
    {
      label: "Total Calls",
      value: kpis.totalCalls.toLocaleString(),
      tone: "primary"
    },
    {
      label: "Connected Calls",
      value: `${kpis.connectedCalls.toLocaleString()} (${kpis.connectionRate}%)`,
      tone: "success"
    },
    {
      label: "Abandoned Calls",
      value: `${kpis.notConnectedCalls.toLocaleString()} (${kpis.notConnectedPercentage}%)`,
      tone: "error"
    },
    {
      label: "Avg Call Duration",
      value: kpis.avgCallDuration,
      tone: "neutral"
    },
    {
      label: "Avg Agent Duration",
      value: kpis.avgAgentDuration,
      tone: "neutral"
    }
  ],
  [kpis]
);

  const connectedTotal = charts.connectedByShift.reduce(
  (sum, item) => sum + item.value,
  0
);

const notConnectedHourlyFiltered = charts.hourly.filter(
  item => item.notConnectedCalls > 50
);

const connectedByShiftWithPercent = charts.connectedByShift.map(item => ({
  ...item,
  percent: ((item.value / connectedTotal) * 100).toFixed(0)
}));


const notConnectedTotal = charts.notConnectedByShift.reduce(
  (sum, item) => sum + item.value,
  0
);

const notConnectedByShiftWithPercent = charts.notConnectedByShift.map(item => ({
  ...item,
  percent: ((item.value / notConnectedTotal) * 100).toFixed(0)
}));

const shiftTotal = charts.shifts.reduce(
  (sum, item) => sum + item.value,
  0
);

const shiftsWithPercent = charts.shifts.map(item => ({
  ...item,
  percent:
    shiftTotal > 0
      ? ((item.value / shiftTotal) * 100).toFixed(1)
      : 0
}));

const shiftComparison = charts.connectedByShift.map((item, index) => ({
  name: item.name,
  connected: item.value,
  abandoned: charts.notConnectedByShift[index]?.value || 0
}));  

const incomingHourlyFiltered = charts.hourly.filter(
  item => item.totalCalls >= 1000
);

const connectedHourlyFiltered = charts.hourly.filter(
  item => item.connectedCalls >= 1000
);

const dropRateFiltered = charts.hourly.filter(
  item => item.dropRate > 2
);

  return (
    <Box className="app-shell">
      <AppBar position="sticky" elevation={0} color="inherit" className="top-bar">
        <Toolbar className="toolbar">
          <Box sx={{ flexGrow: 1 }}>
  <Typography variant="h5" component="h1" fontWeight={800}>
    Inbound Call Center Performance
  </Typography>
</Box>

<Box sx={{ display: "flex", gap: 1 }}>
  <input
    ref={fileInputRef}
    hidden
    type="file"
    accept=".csv,text/csv"
    onChange={handleUpload}
  />

  <Button
    variant="contained"
    startIcon={<FileUploadIcon />}
    onClick={() => fileInputRef.current?.click()}
    disabled={uploading}
    sx={{
    fontSize: "0.8rem",   // smaller text
    fontWeight: 600,
    textTransform: "none"
  }}
  >
    {uploading ? "Uploading" : "Upload CSV"}
  </Button>

  <Button
    variant="outlined"
    startIcon={<RefreshIcon />}
    onClick={() => {
      loadFilters();
      loadDashboard();
    }}
  >
    Refresh
  </Button>
</Box>
          
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} className="dashboard-container">
        <FilterBar
          filters={filters}
          options={filterOptions}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
          onUploadComplete={async (result) => {
            await loadFilters();
            await loadDashboard();
            setToast({
              severity: "success",
              message: `Upload complete: ${result.insertedRows} inserted, ${result.skippedRows} skipped, ${result.failedRows} failed.`
            });
          }}
          onUploadError={(message) => setToast({ severity: "error", message })}
        />
        
        {loading ? (
          <Box className="loading-state">
            <CircularProgress />
          </Box>
        ) : (
          <Box className="dashboard-grid">
            <Box className="main-dashboard">
             <Box
  sx={{
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 2,
    mb: 2
  }}
>
  {kpiCards.map((card) => (
    <KpiCard key={card.label} {...card} />
  ))}
</Box>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <DonutChartCard
      title="Calls By Year"
      data={charts.callsByYear}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <MonthlyStackedChart
      title="Calls By Month"
      data={charts.callsByMonth}
    />
  </Grid>
</Grid>

<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <DonutChartCard
      title="Call Ending Point"
      data={charts.callEnd}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <DonutChartCard
      title="Group Distribution"
      data={charts.groups}
    />
  </Grid>
</Grid>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <DonutChartCard
      title="Disposition Distribution"
      data={charts.dispositions}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <BarChartCard
      title="Top 5 Sub Dispositions"
      data={topSubDispositionData}
      color="#235789"
      wrapLabels={true}
    />
  </Grid>
</Grid>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <HourlyChartCard
      title="Incoming Calls by Hour"
      data={incomingHourlyFiltered}
      metric="totalCalls"
      color="#235789"
       lineColor="#0f2f57"
      minValueLabel={1000}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <HourlyChartCard
      title="Connected Calls by Hour"
      data={connectedHourlyFiltered}
      metric="connectedCalls"
      color="#2f7d4f"
      lineColor="#14532d"
      minValueLabel={1000}
    />
  </Grid>
</Grid>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <HourlyChartCard
      title="Abandoned Calls by Hour"
      data={notConnectedHourlyFiltered}
      metric="notConnectedCalls"
      color="#6b7280"
      lineColor="#374151"
      minValueLabel={50}
      minPercentLabel={0}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <HourlyChartCard
      title="Call Drop Rate by Hour"
      data={dropRateFiltered}
      metric="dropRate"
      color="#c44949"
      lineColor="#7f1d1d"

      unit="%"
      minPercentLabel={2}
    />
  </Grid>
</Grid>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <BarChartCard
  title="Calls Per Shift"
  data={shiftsWithPercent}
  color="#235789"
  showPercent={true}
  showValues={true}
/>
  </Grid>

  <Grid item xs={12} lg={6}>
    <ShiftComparisonChart
      title="Call Outcome by Shift"
      data={shiftComparison}
    />
  </Grid>
</Grid>



<Grid container spacing={2} className="section-grid">
  <Grid item xs={12} lg={6}>
    <BarChartCard
      title="Top 10 Agents"
      data={charts.topAgents}
      color="#235789"
      barSize={35}
      percentFontSize={9}
      labelFontSize={8}
      showValues={true}
    />
  </Grid>

  <Grid item xs={12} lg={6}>
    <BarChartCard
      title="Bottom 10 Agents"
      data={charts.bottomAgents}
      color="#6b7280"
      barSize={35}
      percentFontSize={9}
      labelFontSize={8}
      showValues={true}
    />
  </Grid>
</Grid>
            </Box>

            <InsightPanel summary={summary} />
          </Box>
        )}
      </Container>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

export default App;
