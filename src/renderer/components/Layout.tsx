import {
  AppBar,
  Container,
  createMuiTheme,
  CssBaseline,
  Tab,
  Tabs,
  ThemeProvider,
} from "@material-ui/core"
import * as React from "react"
import Changelog from "./Changelog"
import ExportToMailChimp from "./ExportToMailChimp"

const theme = createMuiTheme({
  palette: {
    primary: {
      main: "#7c655c",
    },
    secondary: { main: "#e68668" },
    background: {
      default: "#fcf9ec",
      paper: "#ffffff",
    },
  },
})

type TabKeys = "exportToMailchimp" | "changelog"

function Layout() {
  const [selected, setSelected] = React.useState<TabKeys>("exportToMailchimp")

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar>
        <Tabs value={selected} onChange={(e, i) => setSelected(i)}>
          <Tab value="exportToMailchimp" label="MailChimp" />
          <Tab value="changelog" label="Changelog" />
        </Tabs>
      </AppBar>
      <Container style={{ marginTop: 72 }}>
        {selected === "exportToMailchimp" && <ExportToMailChimp />}
        {selected === "changelog" && <Changelog />}
      </Container>
    </ThemeProvider>
  )
}
export default Layout
