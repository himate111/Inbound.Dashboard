import { useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import FileUploadIconModule from "@mui/icons-material/FileUpload";

import { uploadCsv } from "../services/api.js";

const FileUploadIcon = FileUploadIconModule.default || FileUploadIconModule;

const monthNames = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec"
};

function MultiSelect({ label, value, options, onChange }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        onChange={(event) => onChange(event.target.value)}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => (
          <Box className="chip-row">
            {selected.slice(0, 2).map((item) => (
              <Chip key={item} label={item} size="small" />
            ))}
            {selected.length > 2 ? <Chip label={`+${selected.length - 2}`} size="small" /> : null}
          </Box>
        )}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={value.includes(option)} />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function FilterBar({ filters, options, onChange, onReset, onUploadComplete, onUploadError }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const update = (key, value) => {
    onChange((current) => ({ ...current, [key]: value }));
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const result = await uploadCsv(file);
      await onUploadComplete(result);
    } catch (error) {
      onUploadError(error.response?.data?.message || "CSV upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <Paper className="filter-bar" elevation={0}>
    
        
      
      

<Grid container spacing={1}>
  <Grid item lg={1}>
  <MultiSelect
    label="Year"
    value={filters.year}
    options={options.years}
    onChange={(value) => update("year", value)}
  />
</Grid>

  <Grid item lg={1}>
  <MultiSelect
    label="Month"
    value={filters.month}
    options={options.months.map(
      (month) => monthNames[month] || month
    )}
    onChange={(value) => update("month", value)}
  />
</Grid>

  <Grid item lg={1.5}>
    <TextField
      fullWidth
      size="small"
      label="Start Date"
      type="date"
      value={filters.startDate}
      onChange={(event) => update("startDate", event.target.value)}
      InputLabelProps={{ shrink: true }}
    />
  </Grid>

  <Grid item lg={1.5}>
    <TextField
      fullWidth
      size="small"
      label="End Date"
      type="date"
      value={filters.endDate}
      onChange={(event) => update("endDate", event.target.value)}
      InputLabelProps={{ shrink: true }}
    />
  </Grid>

  <Grid item lg={1.3}>
    <MultiSelect
      label="Group Name"
      value={filters.groupName}
      options={options.groups}
      onChange={(value) => update("groupName", value)}
    />
  </Grid>

  <Grid item lg={1}>
    <MultiSelect
      label="Agent"
      value={filters.agent}
      options={options.agents}
      onChange={(value) => update("agent", value)}
    />
  </Grid>

  <Grid item lg={1.2}>
    <MultiSelect
      label="Disposition"
      value={filters.disposition}
      options={options.dispositions}
      onChange={(value) => update("disposition", value)}
    />
  </Grid>

  <Grid item lg={1.4}>
    <MultiSelect
      label="Sub Disposition"
      value={filters.subDisposition}
      options={options.subDispositions}
      onChange={(value) => update("subDisposition", value)}
    />
  </Grid>

  <Grid item lg={1}>
    <MultiSelect
      label="Shift"
      value={filters.shift}
      options={options.shifts}
      onChange={(value) => update("shift", value)}
    />
  </Grid>

  <Grid item lg={1.1}>
  <Button
  fullWidth
  variant="contained"
  onClick={onReset}
  sx={{
    height: 40,
    mt: "1px",
    textTransform: "none",
    fontWeight: 600,
    backgroundColor: "#235789",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#1d4b73"
    }
  }}
>
  Reset
</Button>
</Grid>
</Grid>

    </Paper>
  );
}

export default FilterBar;
