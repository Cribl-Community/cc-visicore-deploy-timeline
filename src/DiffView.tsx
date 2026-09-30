import { Collapse, CollapseGroup, Text, Alert } from '@capra/core';
import type { DiffFile } from './api';
import { shortPath } from './model';

/** Renders diff2html-shaped JSON. Insert/delete rows use status background tokens; text stays in text tokens. */
export function DiffView({ files, tooBig }: { files: DiffFile[]; tooBig?: boolean }) {
  if (files.length === 0) return <Text variant="body-sm-normal" color="tertiary">No file changes in this commit.</Text>;
  return (
    <div className="diff">
      {tooBig && <Alert appearance="warning" title="Diff truncated">The diff exceeded the line limit; showing the first part only.</Alert>}
      <CollapseGroup>
        {files.map((f, i) => {
          const name = f.newName && f.newName !== '/dev/null' ? f.newName : f.oldName;
          return (
            <Collapse key={`${name}-${i}`} title={shortPath(name)} defaultExpanded={i < 3}
              headerTrailingContentSlot={<span className="diff-counts"><Text variant="body-xs-semibold" color="success">+{f.addedLines}</Text> <Text variant="body-xs-semibold" color="attention">−{f.deletedLines}</Text></span>}>
              <Text as="div" variant="body-xs-normal" color="tertiary">{name}</Text>
              <table className="diff-table">
                <tbody>
                  {f.blocks.flatMap((b, bi) => [
                    <tr key={`h${bi}`} className="diff-hunk"><td colSpan={3}>{b.header}</td></tr>,
                    ...b.lines.map((l, li) => (
                      <tr key={`${bi}-${li}`} className={`diff-${l.type}`}>
                        <td className="diff-num">{l.oldNumber ?? ''}</td>
                        <td className="diff-num">{l.newNumber ?? ''}</td>
                        <td className="diff-code"><span className="diff-sign">{l.type === 'insert' ? '+' : l.type === 'delete' ? '−' : ' '}</span>{stripSign(l.content)}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </Collapse>
          );
        })}
      </CollapseGroup>
    </div>
  );
}

function stripSign(s: string) {
  return /^[+\- ]/.test(s) ? s.slice(1) : s;
}
