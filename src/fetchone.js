import { existsSync, mkdirSync, createWriteStream } from 'fs'
import { writeFile } from 'fs/promises'
import dukascopyNode from 'dukascopy-node'

import parameters from './config/parameters.js'
import instruments from './instruments.js'

import {program} from 'commander'
import { exit } from 'process'

const { getHistoricRates } = dukascopyNode

const logger = createWriteStream('log.txt', {
  flags: 'a' // 'a' means appending (old data will be preserved)
})

const fetch = async (instrumentIDs, fromDate, toDate, timeframe) => {
  console.log('Downloading...\n')

  for (const instrumentID of instrumentIDs) {
    const { minStartDate } = instruments[instrumentID]
    const startDate = new Date(minStartDate)

    startDate.setDate(startDate.getDate() + 1) // actual start day is the day after minStartDay

    const date = fromDate > startDate ? new Date(fromDate) : startDate
    const symbol = instrumentID.toUpperCase()
    const folderPath = `data/${symbol}`

    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true })

    while (date <= toDate) {
      const fromDateFormatted = date.toISOString().slice(0, 10)

      date.setDate(date.getDate() + 1)

      const toDateFormatted = date.toISOString().slice(0, 10)

      try {
        const data = await getHistoricRates({
          instrument: instrumentID,
          dates: {
            from: fromDateFormatted,
            to: toDateFormatted,
          },
          timeframe,
          batchSize:10,
        })

        if (data.length) {
          const filePath = `${folderPath}/${fromDateFormatted}.csv`

          writeFile(filePath, data.map(row => row.join()).join('\n')).then(() =>
            console.log(`${symbol} ${fromDateFormatted} ✔`),
          )
        } else {
          console.log(`${symbol} ${fromDateFormatted} ❌ (no data)`)
        }
      } catch (err) {
        console.error(`Error: ${fromDateFormatted} ${err}`)
        logger.write(instrumentID + ',' + fromDateFormatted+ '\n')
      }
    }
  }
}

//

program.version('0.0.1');

program
 .option('-s, --symbol <symbol>', 'symbol')
 .option('-f, --from <date>', 'from date')
 .option('-e, --end <date>', 'to date')
 .option('-t, --tif <timeframe>', 'timeframe', 'tick')

program.parse(process.argv);

if (program.symbol === undefined || program.from === undefined) exit(1)

const download_parameters =
{
  instrumentIDs: [
    program.symbol.toLowerCase()
  ],
  fromDate: program.from,
  toDate: program.toDate === undefined ? program.from : program.end,
  timeframe: program.tif,
}

console.log(download_parameters)
const { instrumentIDs, fromDate = '1900-01-01', toDate = new Date(), timeframe } = download_parameters

fetch(instrumentIDs, new Date(fromDate), new Date(toDate), timeframe).finally(()=>logger.end())