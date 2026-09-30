import { groupUrl, LEADER_TARGET } from './links';
import { useEffect, useState } from 'react';
import { Drawer, Text, Tag, Skeleton, Alert } from '@capra/core';
import { GitAdd, GitModified, GitRemove, RocketLaunch } from '@capra/icons';
import { showCommit, changedFiles, firstGroup, type GitShow, type GitFile } from './api';
import type { Commit, GroupState } from './model';
import { initials, shortPath, displayAuthor } from './model';
import { DiffView } from './DiffView';
import { DeployButtons } from './actions';

type Props = { commit: Commit | null; groups: GroupState[]; onClose: () => void; onChanged: () => void };

const STATE_ICON = { A: GitAdd, M: GitModified, D: GitRemove } as const;
const STATE_COLOR = { A: 'success', M: 'info', D: 'danger' } as const;

export function CommitDrawer({ commit, groups, onClose, onChanged }: Props) {
  const [data, setData] = useState<{ show?: GitShow; files: GitFile[]; error?: string } | null>(null);
  useEffect(() => {
    if (!commit) return;
    let alive = true;
    Promise.all([firstGroup(commit.groups, (g) => showCommit(g, commit.hash)), firstGroup(commit.groups, (g) => changedFiles(g, commit.hash))])
      .then(([show, files]) => alive && setData({ show, files }))
      .catch((e: Error) => alive && setData({ files: [], error: e.message }));
    return () => { alive = false; };
  }, [commit]);
  const byId = new Map(groups.map((g) => [g.id, g]));
  return (
    <Drawer isOpen={!!commit} onClose={onClose} width={860} modal={false}
      title={commit ? <Drawer.Heading>{commit.message || '(no message)'}</Drawer.Heading> : undefined}>
      {commit && (
        <div className="drawer-body">
          <div className="drawer-actions"><DeployButtons commit={commit} groups={groups} onDone={() => { onChanged(); onClose(); }} /></div>
          <div className="drawer-meta">
            <span className="avatar">{initials(commit.author_name || '?')}</span>
            <div>
              <Text as="div" variant="body-sm-semibold">{displayAuthor(commit.author_name)}</Text>
              <Text as="div" variant="body-xs-normal" color="tertiary">{commit.author_email} · {new Date(commit.time).toLocaleString()}</Text>
            </div>
            <button type="button" className="linkish" title="Copy full hash" onClick={() => { navigator.clipboard?.writeText(commit.hash).catch(() => undefined); }}><Text variant="code" color="secondary">{commit.hash.slice(0, 12)}</Text></button>
          </div>
          {commit.body && <Text as="pre" variant="body-sm-normal" color="secondary">{commit.body}</Text>}
          <div className="drawer-tags">
            {commit.deployedTo.map((gid) => (
              <span key={gid} className="deployed-pill"><RocketLaunch size="sm" /><Text variant="body-xs-semibold" color="success">Deployed · {byId.get(gid)?.name ?? gid}</Text></span>
            ))}
            {commit.groups.map((gid) => <a key={gid} className="linkish" href={groupUrl(gid, !!byId.get(gid)?.isFleet)} target={LEADER_TARGET} rel="noreferrer" title="Open this group in Cribl"><Tag size="sm">{byId.get(gid)?.name ?? gid}</Tag></a>)}
            {commit.refs && <Tag size="sm" color="highlight">{commit.refs}</Tag>}
          </div>
          {!data && <Skeleton active paragraph={{ rows: 6 }} />}
          {data?.error && <Alert appearance="danger" title="Could not load diff">{data.error}</Alert>}
          {data && !data.error && (
            <>
              <div className="drawer-files">
                {data.files.map((f) => {
                  const st = (f.state ?? 'M') as keyof typeof STATE_ICON;
                  return <Tag key={f.name} size="sm" color={STATE_COLOR[st] ?? 'default'} icon={STATE_ICON[st] ?? GitModified}>{shortPath(f.name)}</Tag>;
                })}
              </div>
              <DiffView files={data.show?.diffJson ?? []} tooBig={data.show?.isTooBig} />
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
