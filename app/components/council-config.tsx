import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";

import { ServiceProvider } from "@/app/constant";
import { useAllModels } from "@/app/utils/hooks";
import { CouncilConfig, CouncilParticipant } from "@/app/store";
import { COUNCIL_PROVIDERS } from "@/app/utils/council";
import Locale from "@/app/locales";
import { ListItem, Select } from "./ui-lib";
import { IconButton } from "./button";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import ResetIcon from "../icons/reload.svg";
import styles from "./council-config.module.scss";

/**
 * Numeric field that keeps the raw text while the user is typing.
 *
 * Clamping on every keystroke makes the field impossible to edit: clearing it
 * to retype a value collapses to the minimum, so the next digit lands on the
 * end of that minimum ("1" + "2" -> 12). This keeps a local draft and only
 * commits a parsed integer on change/blur.
 */
function RoundsInput(props: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(props.value));

  useEffect(() => {
    setDraft(String(props.value));
  }, [props.value]);

  const commit = (raw: string) => {
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 1) {
      props.onChange(1);
      setDraft("1");
    } else {
      props.onChange(parsed);
      setDraft(String(parsed));
    }
  };

  return (
    <input
      type="number"
      min={1}
      aria-label={props.ariaLabel}
      value={draft}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        setDraft(raw);
        const parsed = Math.floor(Number(raw));
        if (raw !== "" && Number.isFinite(parsed) && parsed >= 1) {
          props.onChange(parsed);
        }
      }}
      onBlur={(e) => commit(e.currentTarget.value)}
    ></input>
  );
}

export function CouncilConfigList(props: {
  councilConfig: CouncilConfig;
  updateConfig: (updater: (config: CouncilConfig) => void) => void;
}) {
  const allModels = useAllModels();

  const modelsByProvider = useMemo(() => {
    const map: Record<string, { name: string; displayName: string }[]> = {};
    for (const m of allModels) {
      const providerName = m.provider?.providerName;
      if (!providerName) continue;
      if (!map[providerName]) map[providerName] = [];
      map[providerName].push({
        name: m.name,
        displayName: m.displayName ?? m.name,
      });
    }
    return map;
  }, [allModels]);

  const update = (updater: (config: CouncilConfig) => void) => {
    props.updateConfig((config) => {
      updater(config);
    });
  };

  const participants = props.councilConfig.participants;

  const addParticipant = () => {
    const providerName = COUNCIL_PROVIDERS[0];
    const firstModel = modelsByProvider[providerName]?.[0]?.name ?? "";
    update((config) => {
      config.participants = config.participants.concat({
        id: nanoid(),
        providerName,
        model: firstModel,
        apiKey: "",
      });
    });
  };

  const removeParticipant = (index: number) => {
    update((config) => {
      config.participants = config.participants.filter((_, i) => i !== index);
      if (config.synthesizerIndex >= config.participants.length) {
        config.synthesizerIndex = 0;
      }
    });
  };

  const patchParticipant = (
    index: number,
    patch: Partial<CouncilParticipant>,
  ) => {
    update((config) => {
      config.participants = config.participants.map((p, i) =>
        i === index ? { ...p, ...patch } : p,
      );
    });
  };

  return (
    <>
      <ListItem
        title={Locale.Settings.Council.Enable.Title}
        subTitle={Locale.Settings.Council.Enable.SubTitle}
      >
        <input
          type="checkbox"
          checked={props.councilConfig.enable}
          onChange={(e) =>
            update((config) => (config.enable = e.currentTarget.checked))
          }
        ></input>
      </ListItem>

      {props.councilConfig.enable && (
        <>
          {participants.map((participant, index) => (
            <ListItem
              key={participant.id}
              title={Locale.Settings.Council.Participant.Title(index + 1)}
              subTitle={Locale.Settings.Council.Participant.SubTitle}
              vertical
            >
              <div className={styles["participant-fields"]}>
                <Select
                  aria-label={Locale.Settings.Council.Participant.Provider}
                  className={styles["full-width-select"]}
                  value={participant.providerName}
                  onChange={(e) => {
                    const providerName = e.currentTarget
                      .value as ServiceProvider;
                    const firstModel =
                      modelsByProvider[providerName]?.[0]?.name ?? "";
                    patchParticipant(index, {
                      providerName,
                      model: firstModel,
                    });
                  }}
                >
                  {COUNCIL_PROVIDERS.map((p) => (
                    <option value={p} key={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={Locale.Settings.Council.Participant.Model}
                  className={styles["full-width-select"]}
                  value={participant.model}
                  searchable
                  onChange={(e) =>
                    patchParticipant(index, { model: e.currentTarget.value })
                  }
                >
                  {(modelsByProvider[participant.providerName] ?? []).map(
                    (m) => (
                      <option value={m.name} key={m.name}>
                        {m.displayName}
                      </option>
                    ),
                  )}
                </Select>
                <input
                  aria-label={Locale.Settings.Council.Participant.ApiKey}
                  className={styles["api-key-input"]}
                  type="text"
                  value={participant.apiKey ?? ""}
                  placeholder={
                    Locale.Settings.Council.Participant.ApiKeyPlaceholder
                  }
                  onChange={(e) =>
                    patchParticipant(index, { apiKey: e.currentTarget.value })
                  }
                ></input>
                <div className={styles["participant-actions"]}>
                  <IconButton
                    aria={Locale.Settings.Council.Participant.SetSynthesizer}
                    text={Locale.Settings.Council.Participant.SetSynthesizer}
                    icon={<ResetIcon />}
                    type={
                      props.councilConfig.synthesizerIndex === index
                        ? "primary"
                        : null
                    }
                    onClick={() =>
                      update((config) => (config.synthesizerIndex = index))
                    }
                  />
                  <IconButton
                    aria={Locale.Settings.Council.Participant.Remove}
                    text={Locale.Settings.Council.Participant.Remove}
                    icon={<DeleteIcon />}
                    disabled={participants.length <= 2}
                    onClick={() => removeParticipant(index)}
                  />
                </div>
              </div>
            </ListItem>
          ))}

          <ListItem
            title={Locale.Settings.Council.AddParticipant.Title}
            subTitle={Locale.Settings.Council.AddParticipant.SubTitle}
          >
            <IconButton
              aria={Locale.Settings.Council.AddParticipant.Button}
              text={Locale.Settings.Council.AddParticipant.Button}
              icon={<AddIcon />}
              onClick={addParticipant}
            />
          </ListItem>

          <ListItem
            title={Locale.Settings.Council.Rounds.Title}
            subTitle={Locale.Settings.Council.Rounds.SubTitle}
          >
            <RoundsInput
              ariaLabel={Locale.Settings.Council.Rounds.Title}
              value={props.councilConfig.rounds}
              onChange={(rounds) =>
                update((config) => (config.rounds = rounds))
              }
            ></RoundsInput>
          </ListItem>

          <ListItem
            title={Locale.Settings.Council.MergeMode.Title}
            subTitle={Locale.Settings.Council.MergeMode.SubTitle}
          >
            <Select
              aria-label={Locale.Settings.Council.MergeMode.Title}
              value={props.councilConfig.mergeMode}
              onChange={(e) =>
                update(
                  (config) =>
                    (config.mergeMode = e.currentTarget
                      .value as CouncilConfig["mergeMode"]),
                )
              }
            >
              <option value="synthesize">
                {Locale.Settings.Council.MergeMode.Synthesize}
              </option>
              <option value="longest">
                {Locale.Settings.Council.MergeMode.Longest}
              </option>
              <option value="vote">
                {Locale.Settings.Council.MergeMode.Vote}
              </option>
            </Select>
          </ListItem>
        </>
      )}
    </>
  );
}
