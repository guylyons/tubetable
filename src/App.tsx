import { useDeferredValue, useEffect, useMemo, useState } from "react";
import "./index.css";
import { MasterBusPanel } from "./components/MasterBusPanel";
import { MixerSection } from "./components/MixerSection";
import { MixHeader } from "./components/MixHeader";
import { SavedMixesPanel } from "./components/SavedMixesPanel";
import { SearchPanel } from "./components/SearchPanel";
import { TableSection } from "./components/TableSection";
import { deriveMixName } from "./lib/mixNaming";
import { buildChannelStates, createChannel } from "./lib/mixChannels";
import { createEmptyMix, createMixId, readStoredMixState } from "./lib/mixStorage";
import { parseYouTubeVideoId } from "./lib/youtube";
import {
  DRAFT_MIX_KEY,
  MAX_CHANNELS,
  STORAGE_KEY,
  type MixChannel,
  type MixStorage,
  type PersistedMix,
  type SavedMix,
  type YouTubeSearchPayload,
  type YouTubeSearchResult,
} from "./types";

export function App() {
  const storedMixState = useMemo(() => readStoredMixState(), []);
  const [channels, setChannels] = useState<MixChannel[]>(() => storedMixState.draft.channels);
  const [masterVolume, setMasterVolume] = useState<number>(() => storedMixState.draft.masterVolume);
  const [transportPlaying, setTransportPlaying] = useState<boolean>(() => storedMixState.draft.transportPlaying);
  const [mixTitle, setMixTitle] = useState<string>(() => storedMixState.draft.name);
  const [currentMixKey, setCurrentMixKey] = useState<string>(() => storedMixState.currentMixKey);
  const [draftCache, setDraftCache] = useState<Record<string, PersistedMix>>(() => storedMixState.draftCache);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(() => storedMixState.savedMixes);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isResolvingInput, setIsResolvingInput] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const existingVideoIds = useMemo(() => new Set(channels.map(channel => channel.video.videoId)), [channels]);
  const canAddMore = channels.length < MAX_CHANNELS;
  const generatedMixName = useMemo(() => deriveMixName(channels), [channels]);
  const mixName = mixTitle.trim() || generatedMixName;
  const isSavedMix = currentMixKey !== DRAFT_MIX_KEY;
  const activeDraft = useMemo(
    () =>
      ({
        name: mixTitle,
        channels,
        masterVolume,
        transportPlaying,
      }) satisfies PersistedMix,
    [channels, masterVolume, mixTitle, transportPlaying],
  );
  const effectiveDraftCache = useMemo(
    () => ({ ...draftCache, [currentMixKey]: activeDraft }),
    [activeDraft, currentMixKey, draftCache],
  );
  const channelStates = useMemo(() => buildChannelStates(channels, masterVolume), [channels, masterVolume]);
  const audibleChannels = channelStates.filter(channel => channel.effectiveVolume > 0).length;

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentMixKey,
        draft: activeDraft,
        draftCache: effectiveDraftCache,
        savedMixes,
      } satisfies MixStorage),
    );
  }, [activeDraft, currentMixKey, effectiveDraftCache, savedMixes]);

  useEffect(() => {
    const query = deferredQuery;
    if (!query || query.length < 2 || parseYouTubeVideoId(query)) {
      setSearchResults([]);
      setSearchSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError(null);

        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("YouTube search is temporarily unavailable.");
        }

        const data = (await response.json()) as YouTubeSearchPayload;
        setSearchResults(data.results);
        setSearchSuggestions(data.suggestions);
        setShowResults(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSearchResults([]);
        setSearchSuggestions([]);
        setSearchError(error instanceof Error ? error.message : "Unable to search YouTube right now.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveMessage(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [saveMessage]);

  function updateChannel(channelId: string, updater: (channel: MixChannel) => MixChannel) {
    setChannels(currentChannels => currentChannels.map(channel => (channel.id === channelId ? updater(channel) : channel)));
  }

  function resetSearchUi(clearQuery = false) {
    if (clearQuery) {
      setSearchQuery("");
    }
    setSearchResults([]);
    setSearchSuggestions([]);
    setSearchError(null);
    setAddError(null);
    setShowResults(false);
  }

  function loadMix(mix: PersistedMix, mixKey: string) {
    setChannels(mix.channels);
    setMasterVolume(mix.masterVolume);
    setTransportPlaying(mix.transportPlaying);
    setMixTitle(mix.name);
    setCurrentMixKey(mixKey);
    resetSearchUi(true);
  }

  function saveCurrentMix() {
    const timestamp = new Date().toISOString();
    const nextMixId = isSavedMix ? currentMixKey : createMixId();
    const mixToSave: SavedMix = {
      id: nextMixId,
      name: mixName,
      channels,
      masterVolume,
      transportPlaying,
      updatedAt: timestamp,
    };

    setSavedMixes(currentMixes =>
      [mixToSave, ...currentMixes.filter(existingMix => existingMix.id !== mixToSave.id)].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
    setDraftCache(currentCache => ({
      ...currentCache,
      [mixToSave.id]: {
        name: mixToSave.name,
        channels: mixToSave.channels,
        masterVolume: mixToSave.masterVolume,
        transportPlaying: mixToSave.transportPlaying,
      },
    }));
    setCurrentMixKey(mixToSave.id);
    setMixTitle(mixToSave.name);
    setSaveMessage(isSavedMix ? "Mix updated" : "Mix saved");
  }

  function createNewMix() {
    setDraftCache(currentCache => ({
      ...currentCache,
      [DRAFT_MIX_KEY]: createEmptyMix(""),
    }));
    loadMix(createEmptyMix(""), DRAFT_MIX_KEY);
    setSaveMessage("New mix ready");
  }

  function selectMix(targetMixKey: string) {
    const targetDraft = effectiveDraftCache[targetMixKey];
    const savedMix = savedMixes.find(mix => mix.id === targetMixKey);

    if (targetDraft) {
      loadMix(targetDraft, targetMixKey);
      setSaveMessage(targetMixKey === DRAFT_MIX_KEY ? "Draft loaded" : "Mix loaded");
      return;
    }

    if (savedMix) {
      loadMix(savedMix, savedMix.id);
      setSaveMessage("Mix loaded");
    }
  }

  function addResultToMix(video: YouTubeSearchResult) {
    if (!canAddMore) {
      setAddError(`You can mix up to ${MAX_CHANNELS} channels at once.`);
      return;
    }

    if (existingVideoIds.has(video.videoId)) {
      setAddError("That channel is already in the mix.");
      return;
    }

    setChannels(currentChannels => [...currentChannels, createChannel(video)]);
    setTransportPlaying(true);
    resetSearchUi(true);
  }

  async function resolveInputToVideo() {
    const query = searchQuery.trim();

    if (!query) {
      return;
    }

    const pastedVideoId = parseYouTubeVideoId(query);
    if (pastedVideoId) {
      try {
        setIsResolvingInput(true);
        setAddError(null);

        const response = await fetch(`/api/youtube/video?videoId=${encodeURIComponent(pastedVideoId)}`);
        if (!response.ok) {
          throw new Error("That YouTube link could not be resolved.");
        }

        const data = (await response.json()) as { result: YouTubeSearchResult };
        addResultToMix(data.result);
      } catch (error) {
        setAddError(error instanceof Error ? error.message : "Unable to add that YouTube link.");
      } finally {
        setIsResolvingInput(false);
      }

      return;
    }

    if (searchResults.length > 0) {
      addResultToMix(searchResults[0]!);
      return;
    }

    setAddError("Search for a video title or paste a YouTube link.");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <MixHeader
          audibleChannels={audibleChannels}
          channelsCount={channels.length}
          currentMixKey={currentMixKey}
          generatedMixName={generatedMixName}
          isSavedMix={isSavedMix}
          mixName={mixName}
          mixTitle={mixTitle}
          onCreateNewMix={createNewMix}
          onSaveMix={saveCurrentMix}
          onSelectMix={selectMix}
          onSetMixTitle={setMixTitle}
          onToggleTransport={() => setTransportPlaying(currentValue => !currentValue)}
          saveMessage={saveMessage}
          savedMixes={savedMixes}
          transportPlaying={transportPlaying}
        />

        <main className="grid flex-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <SearchPanel
              addError={addError}
              canAddMore={canAddMore}
              deferredQuery={deferredQuery}
              existingVideoIds={existingVideoIds}
              isResolvingInput={isResolvingInput}
              isSearching={isSearching}
              onChangeQuery={value => {
                setSearchQuery(value);
                setShowResults(true);
                setAddError(null);
              }}
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
              searchError={searchError}
              searchQuery={searchQuery}
              searchResults={searchResults}
              searchSuggestions={searchSuggestions}
              showResults={showResults}
            />

            <SavedMixesPanel currentMixKey={currentMixKey} onSelectMix={selectMix} savedMixes={savedMixes} />

            <MasterBusPanel
              masterVolume={masterVolume}
              onChangeMasterVolume={setMasterVolume}
              onClearMix={() => {
                setChannels([]);
                setTransportPlaying(false);
              }}
              onResetChannelBalances={() =>
                setChannels(currentChannels =>
                  currentChannels.map(channel => ({
                    ...channel,
                    muted: false,
                    paused: false,
                    solo: false,
                    volume: 76,
                  })),
                )
              }
              onToggleTransport={() => setTransportPlaying(currentValue => !currentValue)}
              transportPlaying={transportPlaying}
            />
          </aside>

          <div className="space-y-6">
            <TableSection
              channelStates={channelStates}
              onRemoveChannel={channelId => setChannels(currentChannels => currentChannels.filter(item => item.id !== channelId))}
              onToggleMute={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, muted: !currentChannel.muted }))
              }
              onTogglePause={channelId =>
                updateChannel(channelId, currentChannel => ({ ...currentChannel, paused: !currentChannel.paused }))
              }
              transportPlaying={transportPlaying}
            />

            <MixerSection
              channelStates={channelStates}
              onChangeChannelVolume={(channelId, volume) =>
                updateChannel(channelId, currentChannel => ({
                  ...currentChannel,
                  volume,
                }))
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
