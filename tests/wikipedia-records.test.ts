import { describe, expect, it, vi } from 'vitest';
import {
  buildRecordsData,
  fetchWikipediaPage,
  parseRecordTime,
  parseSourcesFile,
  parseWikipediaRecords,
} from '../scripts/wikipedia-records';

const source = {
  country: 'Testland',
  url: '/wiki/List_of_Testland_records_in_athletics',
};

const fixture = `
  <h2>Outdoor</h2>
  <h3>Men</h3>
  <table><tbody>
    <tr><th>Event</th><th>Record</th></tr>
    <tr>
      <td><a title="100 metres">100 m</a></td>
      <td>9.83 <small>(+1.3 m/s)</small></td>
    </tr>
    <tr>
      <td><a title="5000 metres">5000 m</a></td>
      <td>12:35.36<sup>[1]</sup></td>
    </tr>
  </tbody></table>
  <h3>Women</h3>
  <table><tbody>
    <tr><td><a title="100 metres">100 m</a></td><td>10.49</td></tr>
    <tr><td><a title="Marathon">Marathon</a></td><td>2:09.56</td></tr>
  </tbody></table>
  <h4>Women U23</h4>
  <table><tbody>
    <tr><td><a title="200 metres">200 m</a></td><td>19.00</td></tr>
  </tbody></table>
  <h3>Junior Men</h3>
  <table><tbody>
    <tr><td><a title="100 metres">100 m</a></td><td>9.00</td></tr>
  </tbody></table>
  <h2>Indoor</h2>
  <h3>Women</h3>
  <table><tbody>
    <tr><td><a title="100 metres">100 m</a></td><td>9.00</td></tr>
  </tbody></table>
`;

describe('Wikipedia source parsing', () => {
  it('reads JSON-lines sources and removes exact duplicates', () => {
    const line = JSON.stringify(source);
    expect(parseSourcesFile(`${line}\n${line}\n`)).toEqual([source]);
  });

  it('rejects malformed source entries', () => {
    expect(() => parseSourcesFile('{"country":"Testland"}')).toThrow('Invalid country or URL');
  });
});

describe('Wikipedia record parsing', () => {
  it('converts the time formats used in athletics tables', () => {
    expect(parseRecordTime('9.83 (+1.3 m/s)')).toBe(9_830);
    expect(parseRecordTime('12:35.36')).toBe(755_360);
    expect(parseRecordTime('2:09:56')).toBe(7_796_000);
    expect(parseRecordTime('2:09.56', 'Marathon')).toBe(7_796_000);
  });

  it('extracts outdoor men and women without accepting indoor rows', () => {
    const records = parseWikipediaRecords(fixture, source);

    expect(records.men?.['100 metres']?.milliseconds).toBe(9_830);
    expect(records.men?.['5000 metres']?.milliseconds).toBe(755_360);
    expect(records.women?.['100 metres']?.milliseconds).toBe(10_490);
    expect(records.women?.Marathon?.milliseconds).toBe(7_796_000);
    expect(records.women?.['200 metres']).toBeUndefined();
    expect(records.women?.['100 metres']?.sourceUrl).toBe(
      'https://en.wikipedia.org/wiki/List_of_Testland_records_in_athletics#Outdoor',
    );
  });

  it('uses the outdoor heading id for links to record sources', () => {
    const records = parseWikipediaRecords(
      fixture.replace('<h2>Outdoor</h2>', '<h2 id="Outdoor_records">Outdoor</h2>'),
      source,
    );

    expect(records.men?.['100 metres']?.sourceUrl).toBe(
      'https://en.wikipedia.org/wiki/List_of_Testland_records_in_athletics#Outdoor_records',
    );
  });
});

describe('Wikipedia fetching', () => {
  it('retries rate-limited requests and honors an immediate Retry-After', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(new Response('<h2>Outdoor</h2>'));

    await expect(fetchWikipediaPage(source, fetcher)).resolves.toBe('<h2>Outdoor</h2>');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fails the data build when a source page cannot be loaded', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 }));

    await expect(buildRecordsData([source], fetcher)).rejects.toThrow(
      'Failed to load records for Testland: Wikipedia returned HTTP 404',
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('allows a successfully loaded page to contain no supported outdoor records', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`
        <h2>Indoor</h2>
        <p>This country only publishes indoor records.</p>
      `),
    );

    const data = await buildRecordsData([source], fetcher);

    expect(data.sourcePageCount).toBe(1);
    expect(data.events['800 metres']).toEqual({ women: [], men: [] });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
