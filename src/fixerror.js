import { existsSync, mkdirSync, createWriteStream, createReadStream,WriteStream} from 'fs'
import { writeFile } from 'fs/promises'
import dukascopyNode from 'dukascopy-node'

import instruments from './instruments.js'

import csvParser  from 'csv-parser'


const { getHistoricRates } = dukascopyNode

const fetch = async (instrumentIDs, fromDate, toDate, recover_logger:WriteStream) => {
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
          timeframe: 'tick',
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
        recover_logger.write(instrumentID + ',' + fromDateFormatted+ '\n')
      }
    }
  }
}

//

/*const download_parameters =
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

//fetch(instrumentIDs, new Date(fromDate), new Date(toDate), timeframe).finally(()=>logger.end())

*/
const recover_logger = createWriteStream('recover_log.txt', {
    flags: 'a' // 'a' means appending (old data will be preserved)
})
const csv = createReadStream('log.txt')
csv
  .pipe(csvParser({headers: false}))
  .on('data', (row) => {
    console.log(row[0], row[1]);
    fetch([row[0]], new Date(row[1]), new Date(row[1]), recover_logger).then(()=> console.log(row[0],row[1], 'downloaded'))
  })
  .on('error', (e) => {
    console.log(e)
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
    logger.end()
    recovery_logger.end()
  });
