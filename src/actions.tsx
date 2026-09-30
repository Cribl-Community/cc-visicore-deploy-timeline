import { useState } from 'react';
import { Button, Modal, TextArea, Text, Toast } from '@capra/core';
import { RocketLaunch, HistoryOutlined, GitAdd } from '@capra/icons';
import { deployVersion, revertCommit, commitPending } from './api';
import type { Commit, GroupState } from './model';

/** Runs `fn` only after the user confirms a modal that names the exact target. */
function confirm(opts: { title: string; content: string; confirmButtonText: string; danger?: boolean }, fn: () => Promise<unknown>, onDone: () => void) {
  const open = opts.danger ? Modal.danger : Modal.warning;
  open({
    title: opts.title,
    content: opts.content,
    confirmButtonText: opts.confirmButtonText,
    onConfirm: () => {
      fn()
        .then(() => { Toast.success(`${opts.title}: done`); onDone(); })
        .catch((e: Error) => Toast.error(`${opts.title} failed: ${e.message}`, { duration: 0 }));
    },
  });
}

export function DeployButtons({ commit, groups, onDone }: { commit: Commit; groups: GroupState[]; onDone: () => void }) {
  const targets = commit.groups.filter((g) => !commit.deployedTo.includes(g));
  const byId = new Map(groups.map((g) => [g.id, g]));
  return (
    <>
      {targets.map((gid) => {
        const name = byId.get(gid)?.name ?? gid;
        return (
          <Button key={gid} variant="primary" size="sm" leadingIcon={RocketLaunch}
            onClick={() => confirm({
              title: `Deploy to ${name}`,
              content: `Deploy commit ${commit.short} ("${commit.message}") to ${name}. Every worker in ${name} will restart its pipelines on the new configuration.`,
              confirmButtonText: 'Deploy',
            }, () => deployVersion(gid, commit.hash), onDone)}>
            {`Deploy to ${name}`}
          </Button>
        );
      })}
      <Button variant="secondary" appearance="danger" size="sm" leadingIcon={HistoryOutlined}
        onClick={() => confirm({
          title: 'Revert commit',
          content: `Create a new commit in ${byId.get(commit.groups[0])?.name ?? commit.groups[0]} that undoes ${commit.short} ("${commit.message}"). The original commit stays in history. Nothing is deployed until you deploy the revert.`,
          confirmButtonText: 'Revert',
          danger: true,
        }, () => revertCommit(commit.groups[0], commit.hash), onDone)}>
        Revert this commit
      </Button>
    </>
  );
}

export function CommitPendingButton({ group, onDone }: { group: GroupState; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (group.localChanges <= 0) return null;
  const submit = () => {
    if (!message.trim()) return;
    setBusy(true);
    commitPending(group.id, message.trim())
      .then(() => { Toast.success(`Committed ${group.localChanges} change${group.localChanges === 1 ? '' : 's'} in ${group.name}`); setOpen(false); setMessage(''); onDone(); })
      .catch((e: Error) => Toast.error(`Commit failed: ${e.message}`, { duration: 0 }))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Button variant="tertiary" size="xs" leadingIcon={GitAdd} onClick={() => setOpen(true)}>{`Commit ${group.localChanges}`}</Button>
      <Modal isOpen={open} onIsOpenChange={setOpen} title={`Commit pending changes in ${group.name}`}
        confirmButtonText={busy ? 'Committing…' : 'Commit'} onConfirm={submit} onClose={() => setOpen(false)}>
        <div className="stack">
          <Text variant="body-sm-normal" color="secondary">{`${group.localChanges} uncommitted change${group.localChanges === 1 ? '' : 's'} will be committed. Deploying is a separate step.`}</Text>
          <TextArea aria-label="Commit message" placeholder="Commit message" value={message} onChange={setMessage} />
        </div>
      </Modal>
    </>
  );
}
