/* eslint-disable react/jsx-closing-bracket-location */
import LinearProgress from "@material-ui/core/LinearProgress"
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles"
import * as React from "react"

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%",
    },
  })
)

interface Props {
  completed: number
}

export default function Progress(props: Props) {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      <LinearProgress
        hidden={props.completed === 0 || props.completed === 100}
        variant="determinate"
        value={props.completed}
      />
    </div>
  )
}
