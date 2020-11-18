import { instrumentMetaData } from './instrumentMetaData';
import fetch from 'node-fetch';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lzmajs = require('lzma-purejs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const struct = require('python-struct');

export interface IFetchInfo {
    instrument: string,
    year: number,
    month: number,
    day: number,
    hour: number
}

const URL_ROOT = 'https://datafeed.dukascopy.com/datafeed';

function pad(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
}

function roundNum(value: number, decimal = 4): number {
    return Number(value.toFixed(decimal));
}

export function getYMDH(date: Date): number[] {
    const [year, month, day, hours] = [
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours()
    ];

    return [year, month, day, hours];
}

function decompress(buffer: Buffer): number[][] {

    if (buffer.length === 0) {
        return [];
    }
    const result: number[][] = [];
    const format = '>3i2f';
    const decompressedBuffer = lzmajs.decompressFile(buffer) as Buffer;

    const step = struct.sizeOf(format);

    for (let i = 0, n = decompressedBuffer.length; i < n; i += step) {
        const chunk = decompressedBuffer.slice(i, i + step);
        const unpacked = struct.unpack(format, chunk);

        result.push(unpacked);
    }

    return result;
}

function getDecoder(
    startMs: number,
    decimalFactor: number
): (values: number[]) => number[] {
    return function (values: number[]): number[] {
        const [ms, ask, bid, askVolume, bidVolume] = values;

        return [
            ms + startMs,
            ask / decimalFactor,
            bid / decimalFactor,
            ...([askVolume, bidVolume].map(a => roundNum(a)))
        ];
    };

}

export function genUrl(instrument: string, date: Date): string {
    const [year, month, day, hour] = getYMDH(date);
    const [yearPad, monthPad, dayPad, hourPad] = [year, month, day, hour].map(pad);
    const url = `${URL_ROOT}/${instrument.toUpperCase()}/${yearPad}/${monthPad}/${dayPad}/${hourPad}h_ticks.bi5`;
    return url;
}

export function getInfoFromUrl(url: string): [string, Date] {
    const [, year, month, day, hour] = (
        url.match(/(\d{4})\/(\d{2})?\/?(\d{2})?\/?(\d{2})?/) || []
    ).map(n => Number(n) || 0);

    const utcDate = new Date(Date.UTC(year, month, day || 1, hour));

    const instrument = url.split('/')[4];

    return [instrument, utcDate];
}

export function getFilePathFromUrl(url: string): string {
    const [, , , , instrument, yearPad, monthPad, dayPad, hourPad] = url.split('h_')[0].split('/');
    const month = Number(monthPad) + 1;
    const newMonthPad = pad(month);
    const path = `${instrument.toUpperCase()}_${yearPad}_${newMonthPad}_${dayPad}_${hourPad}h_ticks.csv`;
    return path;
}

export function decodeBuffer(buffer: Buffer, decoder: (values: number[]) => number[]): number[][] {
    const data = decompress(buffer);
    const decodedData = data.map(decoder);
    return decodedData
}

export function toCsv(decodedData: number[][]) {
    const csv = decodedData.map(row => row.join()).join('\n');
    return csv;
}


export async function fetchTick(instrument: string, utcDate: Date): Promise<[boolean, number[][]]> {
    const url = genUrl(instrument, utcDate);
    const startDate = utcDate.getTime();
    const { decimalFactor } = instrumentMetaData[instrument.toLowerCase()];
    const decoder = getDecoder(startDate, decimalFactor);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw Error(response.statusText)
        }
        const statusCode = response.status;
        if (statusCode === 404) {
            console.log('status == 404');
            return [true, []];
        }
        const buffer = await response.buffer();
        if (buffer.length === 0) {
            console.log(url, 'buffer.length == 0');
            return [true, []];
        }
        const decodedData = decodeBuffer(buffer, decoder);
        return [true, decodedData];
    }
    catch (error) {
        console.log(error)
        return [false, []];
    }
}

export async function fetchUrl(url: string): Promise<[boolean, number[][]]> {
    const [instrument, utcDate] = getInfoFromUrl(url);
    return await fetchTick(instrument, utcDate);
}

export function getMinStartDate(instrument: string) {
    const { minStartDate } = instrumentMetaData[instrument];
    return minStartDate
}
