/* eslint-disable react/jsx-closing-bracket-location */
import { Button, Dialog, DialogContent } from "@material-ui/core"
import * as axios from "axios"
import { Form, SubmitButton, TextField } from "material-ui-pack"
import * as querystring from "querystring"
import * as React from "react"
import * as ReactMarkdown from "react-markdown"
import Spacer from "../Spacer"
import { GetAccessKey } from "./models/populi/GetAccessKey"
import { PopuliError } from "./models/populi/PopuliError"
import { xml2json } from "./xml2Json"

interface Props {
  disabled: boolean
  onCreated: (populiApiKey: string) => void
}

export default function CreatePopuliApiKey(props: Props) {
  const [open, setOpen] = React.useState(false)
  const [state, setState] = React.useState({
    username: "",
    password: "",
  })
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async () => {
    try {
      setBusy(true)
      const response = await axios.default
        .post(
          `https://montessorinorthwest.populiweb.com/api/`,
          querystring.stringify({
            username: state.username,
            password: state.password,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        )
        .then(resp => {
          return xml2json(resp.data) as Promise<GetAccessKey>
        })

      props.onCreated(response.response.access_key)
      setState({ username: "", password: "" })
      setOpen(false)
    } catch (e) {
      setBusy(false)
      const err = await (xml2json(e.response.data) as Promise<PopuliError>)
      setError(err.error.message)
    }
  }

  return (
    <>
      <Button disabled={props.disabled} onClick={() => setOpen(true)} variant="text">
        Generate New Populi API Key
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogContent>
          <Form
            busy={busy}
            onSubmit={handleSubmit}
            size="small"
            state={state}
            setState={setState}
            margin="normal"
          >
            {error !== null && (
              <div style={{ color: "red" }}>
                <ReactMarkdown source={error} />
              </div>
            )}
            <TextField name="username" />
            <TextField name="password" password />
            <Spacer />
            <SubmitButton>Generate API Key</SubmitButton>
            <Spacer />
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
