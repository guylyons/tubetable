import { ArrowLeft, ArrowRight, ExternalLink, Repeat, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";
import { ChannelTray, type ChannelCardModel } from "./components/ChannelTray";
import { MasterPanel } from "./components/MasterPanel";
import type { MenuItem } from "./components/Menu";
import { PlayerLayer, type PlayerRegistry } from "./components/PlayerLayer";
import { SessionHeader } from "./components/SessionHeader";
import { SessionsPanel, sessionDisplayName } from "./components/SessionsPanel";
import { Stage } from "./components/Stage";
import { StatusBar } from "./components/StatusBar";
import { Toast, type ToastMessage } from "./components/Toast";
import { THEMES, TopBar, type ThemeMode } from "./components/TopBar";
import {
  buildChannelStates,
  createChannel,
  getChannelColor,
  isChannelPlaying,
  moveChannel,
  setAllPaused,
} from "./lib/mixChannels";
import { deleteMix, duplicateMix, getCurrentMix, restoreMix, saveDraft, selectMix, updateMix } from "./lib/mixLibrary";
import { deriveMixName } from "./lib/mixNaming";
import { createEmptyMix, createMixId, readStoredMixState } from "./lib/mixStorage";
import { getShortcutAction } from "./lib/shortcuts";
import { useYouTubeSearch } from "./lib/useYouTubeSearch";
import { parseYouTubeVideoId, seekPlayer } from "./lib/youtube";
import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixLibrary,
  type PersistedMix,
  type PlayerStatus,
  type YouTubeSearchResult,
} from "./types";

const THEME_STORAGE_KEY = "tubetable.theme.v1";

function readStoredTheme(): ThemeMode {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const theme = THEMES.find(option => option.value === storedTheme);
    if (theme) {
      return theme.value;
    }
  } catch {
    // Ignore storage access issues and use the default theme.
  }

  return "grey";
}

function channelNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [library, setLibrary] = useState<MixLibrary>(readStoredMixState);
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [stageExpanded, setStageExpanded] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const search = useYouTubeSearch(searchQuery);
  const [addError, setAddError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isResolvingInput, setIsResolvingInput] = useState(false);
  const players = useRef<PlayerRegistry>(new Map()).current;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const masterVolumeBeforeMute = useRef(100);

  const { currentMixKey, savedMixes } = library;
  const currentMix = getCurrentMix(library);
  const { channels, focusedChannelId, masterVolume, name: mixTitle } = currentMix;
  const channelStates = useMemo(() => buildChannelStates(channels, masterVolume), [channels, masterVolume]);
  const existingVideoIds = useMemo(() => new Set(channels.map(channel => channel.video.videoId)), [channels]);
  const generatedMixName = useMemo(() => deriveMixName(channels), [channels]);
  const canAddMore = channels.length < MAX_CHANNELS;
  const isSavedMix = currentMixKey !== DRAFT_MIX_KEY;
  const stageIndex = Math.max(
    0,
    channelStates.findIndex(channel => channel.id === focusedChannelId),
  );
  const stageChannel = channelStates[stageIndex] ?? null;
  const playingIds = new Set(channels.filter(channel => isChannelPlaying(playerStatuses[channel.id])).map(c => c.id));
  const anyPlaying = playingIds.size > 0;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", getComputedStyle(root).getPropertyValue("--tt-bar").trim());
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in private windows.
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    } catch {
      // Storage can be full or unavailable; the session keeps working in memory.
    }
  }, [library]);

  useEffect(() => {
    document.title = `${mixTitle.trim() || generatedMixName} · Tubetable`;
  }, [mixTitle, generatedMixName]);

  // Leaving browser full screen (Esc) also collapses the stage.
  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setStageExpanded(false);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (channels.length === 0) {
      setStageExpanded(false);
    }
  }, [channels.length]);

  // The expanded stage covers the window, so the page behind it should not scroll.
  useEffect(() => {
    document.documentElement.style.overflow = stageExpanded ? "hidden" : "";
  }, [stageExpanded]);

  function showToast(message: string, undo?: () => void) {
    setToast({ id: Date.now(), message, undo });
  }

  // A user edit, so it bumps the saved session's date.
  function editCurrentMix(updater: (mix: PersistedMix) => PersistedMix) {
    setLibrary(current => updateMix(current, current.currentMixKey, updater, new Date().toISOString()));
  }

  // Playback and layout state that should not count as an edit.
  function setCurrentPlayback(updater: (mix: PersistedMix) => PersistedMix) {
    setLibrary(current => updateMix(current, current.currentMixKey, updater));
  }

  function updateChannel(channelId: string, updater: (channel: MixChannel) => MixChannel) {
    editCurrentMix(mix => ({
      ...mix,
      channels: mix.channels.map(channel => (channel.id === channelId ? updater(channel) : channel)),
    }));
  }

  function updateChannelIn(mixKey: string, channelId: string, patch: Partial<MixChannel>) {
    setLibrary(current =>
      updateMix(current, mixKey, mix => ({
        ...mix,
        channels: mix.channels.map(channel => (channel.id === channelId ? { ...channel, ...patch } : channel)),
      })),
    );
  }

  function handlePlayerStatus(channelId: string, status: PlayerStatus) {
    setPlayerStatuses(current => (current[channelId] === status ? current : { ...current, [channelId]: status }));
  }

  // Player commands run inside the click handler so the browser treats them as user-initiated
  // playback; the state change then keeps every player in sync.
  function setChannelPaused(channelId: string, paused: boolean) {
    const player = players.get(channelId);
    try {
      if (paused) {
        player?.pauseVideo();
      } else {
        player?.playVideo();
      }
    } catch {
      // The iframe can reject commands while it loads; the playback effect retries.
    }

    setCurrentPlayback(mix => ({
      ...mix,
      channels: mix.channels.map(channel => (channel.id === channelId ? { ...channel, paused } : channel)),
    }));
  }

  function setEveryChannelPaused(paused: boolean) {
    for (const channel of channels) {
      try {
        if (paused) {
          players.get(channel.id)?.pauseVideo();
        } else if (playerStatuses[channel.id] !== "error") {
          players.get(channel.id)?.playVideo();
        }
      } catch {
        // See setChannelPaused.
      }
    }

    setCurrentPlayback(mix => ({ ...mix, channels: setAllPaused(mix.channels, paused) }));
  }

  function toggleChannelPlay(channelId: string) {
    setChannelPaused(channelId, isChannelPlaying(playerStatuses[channelId]));
  }

  function togglePlayAll() {
    if (channels.length > 0) {
      setEveryChannelPaused(anyPlaying);
    }
  }

  function seekChannel(channelId: string, seconds: number) {
    const channel = channels.find(item => item.id === channelId);
    const player = players.get(channelId);
    if (!channel || !player) {
      return;
    }

    seekPlayer(player, seconds, !channel.paused);
    updateChannelIn(currentMixKey, channelId, { progressSeconds: seconds });
  }

  function restartSession() {
    for (const channel of channels) {
      const player = players.get(channel.id);
      if (player) {
        seekPlayer(player, 0, !channel.paused);
      }
    }

    setCurrentPlayback(mix => ({
      ...mix,
      channels: mix.channels.map(channel => ({ ...channel, progressSeconds: 0 })),
    }));
    showToast("Restarted every channel from the beginning.");
  }

  function focusChannel(channelId: string) {
    setCurrentPlayback(mix => ({ ...mix, focusedChannelId: channelId }));
  }

  function removeChannel(channelId: string) {
    const index = channels.findIndex(channel => channel.id === channelId);
    const removed = channels[index];
    if (!removed) {
      return;
    }

    const mixKey = currentMixKey;
    editCurrentMix(mix => ({
      ...mix,
      channels: mix.channels.filter(channel => channel.id !== channelId),
      focusedChannelId: mix.focusedChannelId === channelId ? null : mix.focusedChannelId,
    }));
    showToast(`Removed “${removed.video.title}”.`, () =>
      setLibrary(current =>
        updateMix(current, mixKey, mix => {
          if (mix.channels.length >= MAX_CHANNELS || mix.channels.some(channel => channel.id === channelId)) {
            return mix;
          }

          const restored = [...mix.channels];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return { ...mix, channels: restored };
        }),
      ),
    );
  }

  function toggleMasterMute() {
    if (masterVolume > 0) {
      masterVolumeBeforeMute.current = masterVolume;
      editCurrentMix(mix => ({ ...mix, masterVolume: 0 }));
    } else {
      editCurrentMix(mix => ({ ...mix, masterVolume: masterVolumeBeforeMute.current || 100 }));
    }
  }

  function toggleStageExpanded() {
    if (!stageChannel) {
      return;
    }

    if (stageExpanded) {
      setStageExpanded(false);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
      return;
    }

    setStageExpanded(true);
    // Browser full screen is a bonus; the stage still fills the window without it.
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  function resetSearchUi() {
    setSearchQuery("");
    setAddError(null);
    setShowResults(false);
  }

  function focusSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }

  function handleSelectMix(mixKey: string) {
    if (mixKey === currentMixKey) {
      return;
    }

    setLibrary(current => selectMix(current, mixKey, anyPlaying));
    resetSearchUi();
  }

  function saveCurrentMix() {
    const name = mixTitle.trim() || generatedMixName;
    setLibrary(current => saveDraft(current, { id: createMixId(), name, updatedAt: new Date().toISOString() }));
    showToast(`Saved “${name}”. Changes now save automatically.`);
  }

  function createNewMix() {
    const previous = { currentMixKey, draft: library.draft };
    setEveryChannelPaused(true);
    setLibrary(current => ({ ...current, currentMixKey: DRAFT_MIX_KEY, draft: createEmptyMix() }));
    resetSearchUi();

    if (previous.draft.channels.length > 0) {
      showToast("Started a new session. The unsaved one was cleared.", () =>
        setLibrary(current => ({
          ...current,
          currentMixKey: current.savedMixes.some(mix => mix.id === previous.currentMixKey)
            ? previous.currentMixKey
            : DRAFT_MIX_KEY,
          draft: previous.draft,
        })),
      );
    }
  }

  function handleDuplicateMix(mixKey: string) {
    setLibrary(current => duplicateMix(current, mixKey, { id: createMixId(), updatedAt: new Date().toISOString() }));
    showToast("Duplicated the session.");
  }

  function handleDeleteMix(mixKey: string) {
    const index = savedMixes.findIndex(mix => mix.id === mixKey);
    const mix = savedMixes[index];
    if (!mix) {
      return;
    }

    const deleted = { mix, index, wasCurrent: mixKey === currentMixKey };
    setLibrary(current => deleteMix(current, mixKey));
    showToast(`Deleted “${sessionDisplayName(mix)}”.`, () => setLibrary(current => restoreMix(current, deleted)));
  }

  function addResultToMix(video: YouTubeSearchResult) {
    if (!canAddMore) {
      setAddError(`You can mix up to ${MAX_CHANNELS} videos at once.`);
      return;
    }

    if (existingVideoIds.has(video.videoId)) {
      setAddError("That video is already a channel.");
      return;
    }

    const nextChannel = createChannel(video);
    editCurrentMix(mix => ({
      ...mix,
      channels: [...mix.channels, nextChannel],
      focusedChannelId: mix.channels.length === 0 ? nextChannel.id : mix.focusedChannelId,
    }));
    resetSearchUi();
  }

  async function resolveInputToVideo() {
    const query = searchQuery.trim();
    if (!query) {
      focusSearch();
      return;
    }

    const pastedVideoId = parseYouTubeVideoId(query);
    if (pastedVideoId) {
      try {
        setIsResolvingInput(true);
        setAddError(null);

        const response = await fetch(`/api/youtube/video?videoId=${encodeURIComponent(pastedVideoId)}`);
        if (!response.ok) {
          throw new Error("That YouTube link did not load. Check the URL and try again.");
        }

        const data = (await response.json()) as { result: YouTubeSearchResult };
        addResultToMix(data.result);
      } catch (error) {
        setAddError(error instanceof Error ? error.message : "Could not add that YouTube link.");
      } finally {
        setIsResolvingInput(false);
      }

      return;
    }

    if (!search.isSearching && search.results.length > 0) {
      addResultToMix(search.results[0]!);
      return;
    }

    setAddError("Search for a video or paste a YouTube link first.");
  }

  function channelMenuItems(channel: MixChannel, index: number): MenuItem[] {
    return [
      {
        label: "Loop",
        icon: Repeat,
        checked: channel.looped,
        onSelect: () => updateChannel(channel.id, item => ({ ...item, looped: !item.looped })),
      },
      {
        label: "Move left",
        icon: ArrowLeft,
        disabled: index === 0,
        onSelect: () => editCurrentMix(mix => ({ ...mix, channels: moveChannel(mix.channels, channel.id, -1) })),
      },
      {
        label: "Move right",
        icon: ArrowRight,
        disabled: index === channels.length - 1,
        onSelect: () => editCurrentMix(mix => ({ ...mix, channels: moveChannel(mix.channels, channel.id, 1) })),
      },
      {
        label: "Open on YouTube",
        icon: ExternalLink,
        onSelect: () => {
          setChannelPaused(channel.id, true);
          window.open(
            `https://www.youtube.com/watch?v=${channel.video.videoId}&t=${Math.floor(channel.progressSeconds)}s`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      { label: "Remove channel", icon: Trash2, danger: true, onSelect: () => removeChannel(channel.id) },
    ];
  }

  // Keyboard shortcuts read the latest handlers through a ref so the listener is added once.
  const shortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const pointerPressedButtonRef = useRef<HTMLButtonElement | null>(null);
  shortcutHandlerRef.current = event => {
    if (event.key === "Escape" && stageExpanded) {
      toggleStageExpanded();
      return;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;
    const action = getShortcutAction({
      key: event.key,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      targetTag: target?.tagName ?? "BODY",
      targetIsEditable: target?.isContentEditable,
      targetFocusedByKeyboard: target !== pointerPressedButtonRef.current,
      targetInPopup: Boolean(target?.closest('[role="menu"], [role="dialog"]')),
    });
    if (!action) {
      return;
    }

    event.preventDefault();
    switch (action.type) {
      case "togglePlayAll":
        togglePlayAll();
        break;
      case "focusChannel": {
        const channel = channels[action.index];
        if (channel) {
          focusChannel(channel.id);
        }
        break;
      }
      case "toggleMuteFocused":
        if (stageChannel) {
          updateChannel(stageChannel.id, channel => ({ ...channel, muted: !channel.muted }));
        }
        break;
      case "toggleSoloFocused":
        if (stageChannel) {
          updateChannel(stageChannel.id, channel => ({ ...channel, solo: !channel.solo }));
        }
        break;
      case "toggleStage":
        toggleStageExpanded();
        break;
      case "focusSearch":
        focusSearch();
        break;
    }
  };

  useEffect(() => {
    // Remember the button a pointer pressed: it keeps focus, but Space should still reach the
    // transport. Chrome marks it :focus-visible on any key press, so that cannot tell them apart.
    const handlePointerDown = (event: PointerEvent) => {
      pointerPressedButtonRef.current = event.target instanceof Element ? event.target.closest("button") : null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        pointerPressedButtonRef.current = null;
      }
      shortcutHandlerRef.current(event);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const cards: ChannelCardModel[] = channelStates.map((channel, index) => ({
    channel,
    color: getChannelColor(index),
    isOnStage: channel.id === stageChannel?.id,
    isPlaying: playingIds.has(channel.id),
    menuItems: channelMenuItems(channel, index),
    number: channelNumber(index),
    status: playerStatuses[channel.id],
  }));
  const hiddenWhileExpanded = stageExpanded ? "invisible" : "";

  return (
    <div className="relative flex min-h-screen flex-col bg-app text-fg">
      <div className={hiddenWhileExpanded}>
        <TopBar
          addError={addError}
          canAddMore={canAddMore}
          deferredQuery={search.deferredQuery}
          existingVideoIds={existingVideoIds}
          inputRef={searchInputRef}
          isResolvingInput={isResolvingInput}
          isSearching={search.isSearching}
          onChangeQuery={value => {
            setSearchQuery(value);
            setShowResults(true);
            setAddError(null);
          }}
          onChangeTheme={setTheme}
          onCloseResults={() => setShowResults(false)}
          onOpenResults={() => setShowResults(true)}
          onSelectResult={addResultToMix}
          onSelectSuggestion={suggestion => {
            setSearchQuery(suggestion);
            setShowResults(true);
            setAddError(null);
          }}
          onSubmit={() => {
            void resolveInputToVideo();
          }}
          searchError={search.error}
          searchQuery={searchQuery}
          searchResults={search.results}
          searchSuggestions={search.suggestions}
          showResults={showResults}
          theme={theme}
        />
      </div>

      <main className="mx-auto grid w-full max-w-[1760px] flex-1 grid-cols-1 content-start items-start gap-4 px-3 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] xl:gap-5">
        <div className="min-w-0 space-y-3">
          <div className={hiddenWhileExpanded}>
            <SessionHeader
              channelCount={channels.length}
              generatedName={generatedMixName}
              isSaved={isSavedMix}
              name={mixTitle}
              onRename={name => editCurrentMix(mix => ({ ...mix, name }))}
              onSave={saveCurrentMix}
            />
          </div>
          <Stage
            channel={stageChannel}
            channelNumber={channelNumber(stageIndex)}
            color={getChannelColor(stageIndex)}
            expanded={stageExpanded}
            isPlaying={stageChannel ? playingIds.has(stageChannel.id) : false}
            menuItems={stageChannel ? channelMenuItems(stageChannel, stageIndex) : []}
            onFocusSearch={focusSearch}
            onRemove={() => stageChannel && removeChannel(stageChannel.id)}
            onSeek={seconds => stageChannel && seekChannel(stageChannel.id, seconds)}
            onToggleExpand={toggleStageExpanded}
            onToggleMute={() =>
              stageChannel && updateChannel(stageChannel.id, channel => ({ ...channel, muted: !channel.muted }))
            }
            onTogglePlay={() => stageChannel && toggleChannelPlay(stageChannel.id)}
            status={stageChannel ? playerStatuses[stageChannel.id] : undefined}
          />
          <div className={`pt-2 ${hiddenWhileExpanded}`}>
            <ChannelTray
              cards={cards}
              onAddChannel={focusSearch}
              onChangeVolume={(channelId, volume) => updateChannel(channelId, channel => ({ ...channel, volume }))}
              onFocus={focusChannel}
              onToggleMute={channelId => updateChannel(channelId, channel => ({ ...channel, muted: !channel.muted }))}
              onTogglePlay={toggleChannelPlay}
              onToggleSolo={channelId => updateChannel(channelId, channel => ({ ...channel, solo: !channel.solo }))}
            />
          </div>
        </div>

        <aside className={`flex min-w-0 flex-col gap-4 xl:gap-5 xl:pt-[3.75rem] ${hiddenWhileExpanded}`}>
          <MasterPanel
            anyPlaying={anyPlaying}
            hasChannels={channels.length > 0}
            masterVolume={masterVolume}
            onChangeMasterVolume={volume => editCurrentMix(mix => ({ ...mix, masterVolume: volume }))}
            onNewMix={createNewMix}
            onRestart={restartSession}
            onToggleMasterMute={toggleMasterMute}
            onTogglePlayAll={togglePlayAll}
          />
          <SessionsPanel
            anyPlaying={anyPlaying}
            currentMixKey={currentMixKey}
            onDelete={handleDeleteMix}
            onDuplicate={handleDuplicateMix}
            onSelect={handleSelectMix}
            savedMixes={savedMixes}
          />
        </aside>
      </main>

      <div className={`sticky bottom-0 z-30 ${hiddenWhileExpanded}`}>
        <StatusBar
          channels={cards.map(card => ({ id: card.channel.id, color: card.color, isPlaying: card.isPlaying }))}
          onTogglePlayAll={togglePlayAll}
        />
      </div>

      <PlayerLayer
        channels={channelStates}
        mixKey={currentMixKey}
        players={players}
        stageChannelId={stageChannel?.id ?? null}
        stageExpanded={stageExpanded}
        onDuration={(mixKey, channelId, durationSeconds) => updateChannelIn(mixKey, channelId, { durationSeconds })}
        onProgress={(mixKey, channelId, progressSeconds) => updateChannelIn(mixKey, channelId, { progressSeconds })}
        onStatus={handlePlayerStatus}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default App;
