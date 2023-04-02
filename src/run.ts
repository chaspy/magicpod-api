import * as core from '@actions/core'
import axios, {AxiosResponse} from 'axios'
import {submitMetircs} from './datadog'

type Inputs = {
  dd_api_key: string
  magicpod_api_key: string
  magicpod_organization_name: string
  magicpod_project_name: string
}

interface TestCases {
  succeeded: number
  failed: number
  aborted: number
  unresolved: number
  total: number
}

interface BatchRun {
  batch_run_number: number
  test_setting_name: string
  status: string
  started_at: string
  finished_at: string
  test_cases: TestCases
  url: string
}

interface BatchRuns {
  organization_name: string
  project_name: string
  batch_runs: BatchRun[]
}

interface BatchRunsData {
  batch_run_number: number
  test_setting_name: string
  status: string
  started_at: string
  duration_seconds: number // second
}

// eslint-disable-next-line @typescript-eslint/require-await
export const run = async (inputs: Inputs): Promise<void> => {
  // Load insputs
  const dd_api_key = inputs.dd_api_key
  const magicpod_api_key = inputs.magicpod_api_key
  const magicpod_organization_name = inputs.magicpod_organization_name
  const magicpod_project_name = inputs.magicpod_project_name
  const count = 10

  // Get response from magicpod
  ;(async () => {
    const data = await getBatchRuns(
      magicpod_api_key,
      magicpod_organization_name,
      magicpod_project_name,
      count
    )
    if (data) {
      processBatchRunsData(data)
    } else {
      console.log('Error occurred, no data received')
    }
  })()
}

function processBatchRunsData(batchRunsData: BatchRuns): void {
  let batchRunsDataArray: BatchRunsData[] = []

  batchRunsData.batch_runs.forEach((batchRun, index) => {
    const durationSeconds = calculateTimeDifferenceSecond(
      batchRun.started_at,
      batchRun.finished_at
    )

    const batch_run_number = batchRun.batch_run_number
    const test_setting_name = batchRun.test_setting_name
    const status = batchRun.status
    const started_at = batchRun.started_at
    const timestamp = getUnixTimestamp(started_at)

    submitMetircs(
      timestamp,
      durationSeconds,
      batch_run_number,
      test_setting_name,
      status
    )
  })
}

function getUnixTimestamp(dateString: string): number {
  const dateObject: Date = new Date(dateString)
  const unixTimestamp: number = dateObject.getTime()

  return unixTimestamp
}

function calculateTimeDifferenceSecond(time1: string, time2: string): number {
  const date1 = new Date(time1)
  const date2 = new Date(time2)

  const difference = Math.abs(date2.getTime() - date1.getTime()) // milli seconds

  return difference / 1000 // seconds
}

async function getBatchRuns(
  magicpod_api_key: string,
  magicpod_organization_name: string,
  magicpod_project_name: string,
  count: number
): Promise<BatchRuns | null> {
  const url = `https://app.magicpod.com/api/v1.0/${magicpod_organization_name}/${magicpod_project_name}/batch-runs/?count=${count}`
  const headers = {
    accept: 'application/json',
    Authorization: `Token ${magicpod_api_key}`
  }

  try {
    const response: AxiosResponse<BatchRuns> = await axios.get(url, {headers})
    console.log(response.data)
    return response.data
  } catch (error) {
    console.error(`Error: ${error}`)
    return null
  }
}
