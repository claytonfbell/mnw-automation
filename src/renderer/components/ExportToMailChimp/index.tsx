/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable react/jsx-closing-bracket-location */
import { Box, Grid, Typography } from "@material-ui/core"
import * as axios from "axios"
import { DateTimePicker, Form, SubmitButton, TextField, useStoredState } from "material-ui-pack"
import * as md5 from "md5"
import * as moment from "moment"
import * as querystring from "querystring"
import * as React from "react"
import * as ReactMarkdown from "react-markdown"
import { parseString } from "xml2js"
import Spacer from "../Spacer"
import { MailChimpMember } from "./models/MailChimpMember"
import { MailChimpMergeFields } from "./models/MailChimpMergeFields"
import { MailChimpTag } from "./models/MailChimpTag"
import { Email, GetPersonResponse, PopuliTag } from "./models/populi/GetPersonResponse"
import { GetUpdatedPeopleResponse, UpdatedPerson } from "./models/populi/GetUpdatedPeopleResponse"
import Progress from "./Progress"

interface LogMessage {
  id: number
  message: string
}

let messageCount = 0
// eslint-disable-next-line no-plusplus
const getMessageId = () => messageCount++

interface FormState {
  populiApiKey: string
  mailChimpApiKey: string
  mailChimpListId: string
  startTime: string
  offset: string
}

function ExportToMailChimp() {
  const [isBusy, setIsBusy] = React.useState(false)
  const [state, setState] = useStoredState<FormState>("mnw-automation", {
    populiApiKey: "",
    mailChimpApiKey: "",
    mailChimpListId: "42d5e0fcba",
    startTime: moment().toISOString(),
    offset: "0",
  })

  const [progress, setProgress] = React.useState<number>(0)

  const [logMessages, setLogMessages] = React.useState<LogMessage[]>([])
  const log = (message: string) => {
    // eslint-disable-next-line no-console
    console.log(message)
    setLogMessages(lm => [...lm, { id: getMessageId(), message }])
  }

  // async wrapper
  // https://github.com/Leonidas-from-XIV/node-xml2js/issues/159
  const xml2json = async (xml: string) => {
    return new Promise((resolve, reject) => {
      parseString(xml, { explicitArray: false }, (err, json) => {
        if (err) reject(err)
        else resolve(json)
      })
    })
  }

  const handleSubmit = async () => {
    try {
      setProgress(0)
      setLogMessages([])
      setIsBusy(true)

      const startTime = moment().toISOString()

      let keepGoing = true
      let offset = Number(state.offset)
      const mailChimpAuth = {
        auth: {
          username: "any",
          password: state.mailChimpApiKey,
        },
      }
      let peopleCount = 0

      while (keepGoing) {
        // FETCH UPDATED PEOPLE IN POPULI
        log(
          `Fetching updated people since \`${moment(
            state.startTime
          ).fromNow()}\` with offset \`${offset}\`...`
        )
        const response = await axios.default
          .post(
            `https://montessorinorthwest.populiweb.com/api/`,
            querystring.stringify({
              task: "getUpdatedPeople",
              start_time: moment(state.startTime).format("YYYY-MM-DD HH:mm:ss"),
              offset,
            }),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: state.populiApiKey,
              },
            }
          )
          .then(resp => {
            return xml2json(resp.data) as Promise<GetUpdatedPeopleResponse>
          })

        let updatedPeople: UpdatedPerson[] = []
        if (response.response.person !== undefined) {
          updatedPeople = Array.isArray(response.response.person)
            ? response.response.person
            : [response.response.person]
        }

        if (updatedPeople.length > 0) {
          log(
            `Processing \`${offset + 1} - ${offset + updatedPeople.length} of ${
              response.response.$.num_results
            }\``
          )

          for (let i = 0; i < updatedPeople.length; i++) {
            const p = updatedPeople[i]

            peopleCount++
            setProgress(100 * (peopleCount / Number(response.response.$.num_results)))

            // FETCH MORE DETAILS IN POPULI
            // log(`Fetching details on \`${p.first_name}\` \`${p.last_name}\``)
            const personResponse = await axios.default
              .post(
                `https://montessorinorthwest.populiweb.com/api/`,
                querystring.stringify({
                  task: "getPerson",
                  person_id: p.id,
                }),
                {
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: state.populiApiKey,
                  },
                }
              )
              .then(resp => {
                return xml2json(resp.data) as Promise<GetPersonResponse>
              })

            // LOOP EACH EMAIL ADDRESS
            const { response: person } = personResponse
            const emails: Email[] = Array.isArray(person.email) ? person.email : [person.email]
            for (let j = 0; j < emails.length; j++) {
              // LOOKUP IN MAILCHIMP
              let mcMember = await axios.default
                .get(
                  `https://us7.api.mailchimp.com/3.0/lists/${state.mailChimpListId}/members/${md5(
                    emails[j].address.toLowerCase()
                  )}`,
                  mailChimpAuth
                )
                .then(resp => {
                  return resp.data as Promise<MailChimpMember>
                })
                .catch((err: axios.AxiosError) => {
                  if (err.response?.status === 404) {
                    return null
                  }
                  throw err
                })

              // CREATE NEW MAILCHIMP MEMBER
              if (mcMember === null && emails[j].no_mailings !== true) {
                log(`Adding missing email \`${emails[j].address}\` to MailChimp...`)
                mcMember = await axios.default
                  .post(
                    `https://us7.api.mailchimp.com/3.0/lists/${state.mailChimpListId}/members`,
                    {
                      email_address: emails[j].address,
                      status: "subscribed",
                    },
                    mailChimpAuth
                  )
                  .then(resp => {
                    return resp.data as Promise<MailChimpMember>
                  })
              }

              // now lets make sure mcMember data is up2dat2
              if (mcMember !== null) {
                let doUpdate = false
                const merge_fields: MailChimpMergeFields = {
                  FNAME: "",
                  LNAME: "",
                }
                // update first/last name
                if (person.first !== mcMember.merge_fields.FNAME) {
                  merge_fields.FNAME = person.first
                  doUpdate = true
                }
                if (person.last !== mcMember.merge_fields.LNAME) {
                  merge_fields.LNAME = person.last
                  doUpdate = true
                }
                if (doUpdate) {
                  log(
                    `Updating name from \`${mcMember.merge_fields.FNAME} ${mcMember.merge_fields.LNAME}\` to  \`${merge_fields.FNAME} ${merge_fields.LNAME}\``
                  )
                  mcMember = await axios.default
                    .patch(
                      `https://us7.api.mailchimp.com/3.0/lists/${state.mailChimpListId}/members/${mcMember.id}`,
                      { merge_fields },
                      mailChimpAuth
                    )
                    .then(resp => {
                      return resp.data as Promise<MailChimpMember>
                    })
                }

                // update tags
                const populiTags: PopuliTag[] = Array.isArray(person.tags.tag)
                  ? person.tags.tag
                  : [person.tags.tag]

                const tags: MailChimpTag[] = []
                populiTags.forEach(x => {
                  if (mcMember?.tags.find(y => y.name === x.name) === undefined) {
                    tags.push({ name: x.name, status: "active" })
                  }
                })
                if (tags.length > 0 && mcMember !== null) {
                  log(
                    `Applying tags to \`${mcMember?.email_address}\`: ${tags
                      .map(x => x.name)
                      .join(", ")}`
                  )
                  const r = await axios.default.post(
                    `https://us7.api.mailchimp.com/3.0/lists/${state.mailChimpListId}/members/${mcMember.id}/tags`,
                    { tags },
                    mailChimpAuth
                  )
                }
              }
            }
          }
          offset += updatedPeople.length
          keepGoing = updatedPeople.length > 0
        } else {
          log("*No more results*")
          keepGoing = false
        }
      }
      log("**Done!**")
      setIsBusy(false)
      setProgress(0)
      setState((s: FormState) => ({ ...s, startTime }))
    } catch (e) {
      log("# ERROR")
      log(e.message)
    }
  }
  return (
    <>
      <Typography variant="h4" color="secondary">
        Export From Populi To MailChimp
      </Typography>
      <Spacer />
      <Form
        debug={false}
        busy={isBusy}
        state={state}
        setState={setState}
        onSubmit={handleSubmit}
        size="small"
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField name="populiApiKey" label="Populi API Key" password />
          </Grid>
          <Grid item xs={12}>
            <TextField name="mailChimpApiKey" label="MailChimp API Key" password />
          </Grid>
          <Grid item xs={3}>
            <TextField name="mailChimpListId" label="MailChimp List ID" />
          </Grid>
          <Grid item xs={6}>
            <DateTimePicker name="startTime" label="Query Updates After" />
          </Grid>
          <Grid item xs={3}>
            <TextField
              name="offset"
              label="Query Offset"
              formatter={v => v.replace(/[^0-9]/g, "")}
            />
          </Grid>
        </Grid>

        <Spacer />
        <SubmitButton fullWidth={false}>Start</SubmitButton>
      </Form>
      <Spacer />
      <Progress completed={progress} />
      <Spacer />
      <Box>
        {logMessages.map(lm => (
          <ReactMarkdown key={lm.id} className="markdown-body" source={lm.message} />
        ))}
      </Box>
    </>
  )
}
export default ExportToMailChimp
