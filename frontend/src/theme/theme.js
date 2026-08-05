import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#235789"
    },
    secondary: {
      main: "#2f9c95"
    },
    warning: {
      main: "#d8892f"
    },
    error: {
      main: "#c44949"
    },
    success: {
      main: "#2f7d4f"
    },
    background: {
      default: "#f5f7f9",
      paper: "#ffffff"
    },
    text: {
      primary: "#16212d",
      secondary: "#5d6875"
    }
  },
  typography: {
    fontFamily: ["Inter", "Segoe UI", "Roboto", "Arial", "sans-serif"].join(","),
    h1: { letterSpacing: 0 },
    h2: { letterSpacing: 0 },
    h3: { letterSpacing: 0 },
    h4: { letterSpacing: 0 },
    h5: { letterSpacing: 0 },
    h6: { letterSpacing: 0 },
    button: {
      textTransform: "none",
      fontWeight: 700,
      letterSpacing: 0
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
});
