import { existsSync, mkdirSync, createWriteStream } from 'fs'
import { writeFile } from 'fs/promises'
import dukascopyNode from 'dukascopy-node'

import './patch.js'
import parameters from './config/parameters.js'
import instruments from './instruments.js'

const { getHistoricRates } = dukascopyNode
const { instrumentIDs, fromDate = '1900-01-01', toDate = new Date(), timeframe } = parameters

const logger = createWriteStream('log.txt', {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

const fetchInstrument = async (instrument, fromDate, toDate, timeframes, batchSize) => {
const {minStartDate } = instruments[instrument]
    const startDate = new Date(minStartDate)

    startDate.setDate(startDate.getDate() + 1) // actual start day is the day after minStartDay

    const date = fromDate > startDate ? new Date(fromDate) : startDate
    const symbol = instrument.toUpperCase()
    const folderPath = `data/${symbol}`

    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true })

    while (date <= toDate) {
      const fromDateFormatted = date.toISOString().slice(0, 10)

      date.setDate(date.getDate() + 1)

      const toDateFormatted = date.toISOString().slice(0, 10)

      try {
        const data = await getHistoricRates({
          instrument,
          dates: {
            from: fromDateFormatted,
            to: toDateFormatted,
          },
          timeframes,
          batchSize,
        })

        if (data.length) {
          const filePath = `${folderPath}/${fromDateFormatted}.csv`

          writeFile(filePath, data.map(row => row.join()).join('\n')).then(() =>
            console.log(`[${symbol}] ${fromDateFormatted} ✔`),
          )
        } else {
          console.log(`[${symbol}] ${fromDateFormatted} ❌ (no data)`)
        }
      } catch (err) {
        console.error(`Error: ${fromDateFormatted} ${err}`)
        logger.write(instrument + ',' + fromDateFormatted+ '\n')
      }
    }
}

const fetch = async (instrumentIDs, fromDate, toDate, timeframe) => {
  console.log('Downloading...\n')

  for (const instrumentID of instrumentIDs) {
    await fetchInstrument(instrumentID, fromDate, toDate, timeframe, 10)
  }
}

fetch(instrumentIDs, new Date(fromDate), new Date(toDate), timeframe).finally(()=>logger.end())
