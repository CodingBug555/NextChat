import { useMemo } from "react";
import { nanoid } from "nanoid";

import { ServiceProvider } from "@/app/constant";
import { useAllModels } from "@/app/utils/hooks";
import { CouncilConfig, CouncilParticipant, useAppConfig } from "@/app/store";
import { COUNCIL_PROVIDERS } from "@/app/utils/council";
import Locale from "@/app/locales";
import { ListItem, Select } from "./ui-lib";
import { IconButton } from "./button";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import ResetIcon from "../icons/reload.svg";

export function CouncilConfigList(props: {
  councilConfig: CouncilConfig;
  updateConfig: (updater: (config: CouncilConfig) => void) => void;
}) {
  const allModels = useAllModels();
  const config = useAppConfig();

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
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  width: "100%",
                }}
              >
                <Select
                  aria-label={Locale.Settings.Council.Participant.Provider}
                  value={participant.providerName}
                  onChange={(e) => {
                    const providerName = e.currentTarget
                      .value as ServiceProvider;
                    const firstModel =
                      modelsByProvider[providerName]?.[0]?.name ?? "";
                    patchParticipant(index, { providerName, model: firstModel });
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
                  value={participant.model}
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
                  type="text"
                  value={participant.apiKey ?? ""}
                  placeholder={Locale.Settings.Council.Participant.ApiKeyPlaceholder}
                  onChange={(e) =>
                    patchParticipant(index, { apiKey: e.currentTarget.value })
                  }
                ></input>
                <div style={{ display: "flex", gap: "8px" }}>
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
            <input
              type="number"
              min={1}
              max={5}
              value={props.councilConfig.rounds}
              onChange={(e) =>
                update(
                  (config) =>
                    (config.rounds = Math.min(
                      5,
                      Math.max(1, Number(e.currentTarget.value) || 1),
                    )),
                )
              }
            ></input>
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
              <option value="vote">{Locale.Settings.Council.MergeMode.Vote}</option>
            </Select>
          </ListItem>
        </>
      )}
    </>
  );
}
