import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useGameRole } from '@/hooks/useGameRole';
import { storage, STORAGE_KEYS } from '@/utils';
import { ChevronDownIcon } from '../Icons/ChevronDownIcon';
import loginModalClose from '@/assets/img2/login_modal_close.png';
import styles from './ServerSelectModal.module.less';

interface ServerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (serverName: string, characterName: string, gameUserId: string, userAvatar?: string) => void | Promise<void>;
  currentServer?: string;
  currentCharacter?: string;
  appKey?: string; // 游戏 app_key，用于获取该游戏的角色列表
}

export const ServerSelectModal: React.FC<ServerSelectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentServer,
  currentCharacter,
  appKey,
}) => {
  const { t } = useLanguage();
  const { getRolesByAppKey } = useGameRole(); // 使用全局 hook 获取角色列表
  const [searchText, setSearchText] = useState('');
  const [showServerList, setShowServerList] = useState(false);
  const [showCharacterList, setShowCharacterList] = useState(false);
  const [selectedServer, setSelectedServer] = useState(currentServer || '');
  const [selectedServerPlatform, setSelectedServerPlatform] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState(currentCharacter || '');
  const [isServerInputFocused, setIsServerInputFocused] = useState(false);
  const serverInputRef = useRef<HTMLInputElement>(null);
  const serverListRef = useRef<HTMLDivElement>(null);
  const characterListRef = useRef<HTMLDivElement>(null);
  const suppressServerBlurCloseRef = useRef(false);
  const [gameUserId, setGameUserId] = useState('');
  const initializedRef = useRef(false); // 用于标记是否已初始化
  const [hasUserTyped, setHasUserTyped] = useState(false); // 用于区分用户输入与回填
  const [serverListScrollReady, setServerListScrollReady] = useState(false);
  const [characterListScrollReady, setCharacterListScrollReady] = useState(false);

  const DROPDOWN_SCROLL_ITEM_THRESHOLD = 4;

  const getPlatformLabel = (platform: string | undefined): string => {
    if (!platform) return '';
    const lower = platform.toLowerCase();
    if (lower === 'ios') return 'iOS';
    return platform;
  };

  const formatServerLabel = (channel: string | undefined, platform: string | undefined): string => {
    if (!channel) return '';
    const platformLabel = getPlatformLabel(platform);
    return platformLabel ? `${channel}-${platformLabel}` : channel;
  };

  // 如果没有传入 appKey，尝试从 localStorage 读取
  // 使用 state 存储 effectiveAppKey，以便在游戏切换时能够检测变化
  const savedAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
  const initialEffectiveAppKey = appKey || (savedAppKey ?? undefined);
  const [effectiveAppKey, setEffectiveAppKey] = useState<string | undefined>(initialEffectiveAppKey);
  const previousAppKeyRef = useRef<string | undefined>(initialEffectiveAppKey);

  // 当 appKey prop 变化时，更新 effectiveAppKey 并重置选择状态
  useEffect(() => {
    const savedAppKey = storage.get<string>(STORAGE_KEYS.CURRENT_GAME_APP_KEY, undefined);
    const newEffectiveAppKey = appKey || (savedAppKey ?? undefined);
    
    // 如果 appKey 变化了，重置选择状态
    if (newEffectiveAppKey !== previousAppKeyRef.current) {
      previousAppKeyRef.current = newEffectiveAppKey;
      setEffectiveAppKey(newEffectiveAppKey);
      // 重置选择状态，因为切换游戏后，之前的选择不适用
      setSelectedServer('');
      setSelectedServerPlatform('');
      setSelectedCharacter('');
      setGameUserId('');
      setSearchText('');
      initializedRef.current = false; // 重置初始化标记，允许重新初始化
      setHasUserTyped(false); // 重置用户输入标记
    }
  }, [appKey]); // 只依赖 appKey prop，避免循环依赖

  // 从全局 store 获取游戏角色列表
  const gameRoles = effectiveAppKey ? getRolesByAppKey(effectiveAppKey) : [];
  
  // 从角色列表提取唯一的区服列表（根据 game_server_channel + platform）
  // 每个区服+平台的组合作为一个选项
  const serverMap = new Map<string, { channel: string; platform: string; label: string }>();
  gameRoles.forEach((role) => {
    const key = `${role.game_server_channel}_${role.platform}`;
    if (!serverMap.has(key)) {
      serverMap.set(key, {
        channel: role.game_server_channel,
        platform: role.platform,
        label: formatServerLabel(role.game_server_channel, role.platform),
      });
    }
  });
  
  // 从字符串中提取数字，用于排序
  const extractNumberFromString = (str: string): number => {
    // 使用正则表达式提取字符串中的所有数字
    const match = str.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }
    // 如果没有数字，返回 Infinity，这样会排在最后
    return Infinity;
  };

  // 转换为数组并排序（按 channel 中的数字升序排序）
  const serverList = Array.from(serverMap.values()).sort((a, b) => {
    const numA = extractNumberFromString(a.channel);
    const numB = extractNumberFromString(b.channel);
    // 如果都有数字，按数字排序
    if (numA !== Infinity && numB !== Infinity) {
      return numA - numB;
    }
    // 如果只有一个有数字，有数字的排在前面
    if (numA !== Infinity && numB === Infinity) return -1;
    if (numA === Infinity && numB !== Infinity) return 1;
    // 如果都没有数字，按字符串排序
    return a.channel.localeCompare(b.channel);
  });

  // 根据选中的区服（channel）获取该区服下的角色列表
  // 需要同时匹配 channel 和 platform（如果 selectedServer 包含 platform 信息）
  const characterList = selectedServer
    ? gameRoles
        .filter((role) => {
          // selectedServer 现在是 channel（区服ID），同一个 channel 可能同时存在 iOS / Android
          return (
            role.game_server_channel === selectedServer &&
            (!selectedServerPlatform || role.platform === selectedServerPlatform)
          );
        })
        .map((role) => ({
          label: role.nick_name,
          value: role.game_user_id,
        }))
    : [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleServerSelect = (serverItem: { channel: string; platform: string; label: string }) => {
    const serverChannel = serverItem.channel;
    // 如果选择了新的区服，清空角色选择
    if (serverChannel !== selectedServer || serverItem.platform !== selectedServerPlatform) {
      setSelectedCharacter('');
      setGameUserId('');
    }
    setSelectedServer(serverChannel);
    setSelectedServerPlatform(serverItem.platform);
    setSearchText(serverItem.label); // 显示为 "{channel}-{platform}"，例如 "GL_58-iOS"
    setShowServerList(false);
  };

  const blurServerInputWithoutClosingList = () => {
    if (document.activeElement !== serverInputRef.current) return;

    suppressServerBlurCloseRef.current = true;
    setIsServerInputFocused(false);
    serverInputRef.current?.blur();
    window.setTimeout(() => {
      suppressServerBlurCloseRef.current = false;
    }, 200);
  };

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacter(characterId);
    setShowCharacterList(false);
    setGameUserId(characterId);
  };

  // 根据选中的角色ID获取角色昵称（用于显示）
  const getSelectedCharacterName = (): string => {
    if (!selectedCharacter) return '';
    const role = gameRoles.find((r) => r.game_user_id === selectedCharacter);
    return role?.nick_name || '';
  };

  // 根据区服ID获取显示 label（channel + platform）
  // 优先通过 game_user_id 查找角色，如果找不到再通过 channel 查找
  const getServerLabel = (channel: string | undefined, gameUserId?: string): string => {
    if (!channel) return '';
    
    let role;
    
    // 优先通过 game_user_id 查找角色（最准确的方式）
    if (gameUserId) {
      role = gameRoles.find((r) => r.game_user_id === gameUserId);
      if (role) {
        return formatServerLabel(role.game_server_channel, role.platform);
      }
    }
    
    // 如果通过 game_user_id 找不到，尝试通过 channel 查找
    role = gameRoles.find((r) => r.game_server_channel === channel);
    if (role) {
      return formatServerLabel(role.game_server_channel, role.platform);
    }
    
    // 如果都没找到，返回原始 channel（可能是旧的格式或等待角色列表加载）
    return channel;
  };

  // 弹窗打开时，用当前值预填充（仅在弹窗刚打开时设置一次）
  useEffect(() => {
    if (!isOpen) {
      // 弹窗关闭时，重置初始化标记并收起下拉，避免下次打开仍呈展开态
      initializedRef.current = false;
      setHasUserTyped(false);
      setShowServerList(false);
      setShowCharacterList(false);
      setIsServerInputFocused(false);
      return;
    }

    // 只在弹窗刚打开时初始化一次，并且需要等待 gameRoles 加载完成
    // 当 effectiveAppKey 变化时，initializedRef.current 会被重置，所以会重新初始化
    if (!initializedRef.current) {
      // 如果角色列表还未加载，等待加载完成
      if (gameRoles.length === 0) {
        return;
      }
      
      initializedRef.current = true;
      
      // 预填角色（需要确保角色列表已加载）- 优先处理，因为可以通过 game_user_id 找到正确的 game_server_channel
      if (currentCharacter) {
        // 验证角色是否存在于角色列表中
        const roleExists = gameRoles.some((role) => role.game_user_id === currentCharacter);
        if (roleExists) {
          const role = gameRoles.find((r) => r.game_user_id === currentCharacter);
          if (role) {
            // 使用角色数据中的 game_server_channel 作为 selectedServer
            setSelectedServer(role.game_server_channel);
            setSelectedServerPlatform(role.platform);
            setSelectedCharacter(currentCharacter);
            setGameUserId(currentCharacter);
            // 使用正确的 game_server_channel 显示
            setSearchText(getServerLabel(role.game_server_channel, currentCharacter));
            setHasUserTyped(false);
          }
        }
      } else if (currentServer) {
        // 如果没有角色信息，尝试通过 currentServer 查找
        // 注意：currentServer 可能是旧的服务器ID格式，可能找不到匹配的角色
        setSelectedServer(currentServer);
        const role = gameRoles.find((r) => r.game_server_channel === currentServer);
        setSelectedServerPlatform(role?.platform || '');
        setSearchText(getServerLabel(currentServer));
        setHasUserTyped(false);
      }
    }
  }, [isOpen, currentServer, currentCharacter, gameRoles.length, effectiveAppKey]); // 添加 effectiveAppKey 依赖，确保游戏切换时重新初始化

  // 处理服务器输入框失去焦点
  const handleServerBlur = (e: React.FocusEvent) => {
    setIsServerInputFocused(false);
    if (suppressServerBlurCloseRef.current) return;

    // 检查焦点是否移动到下拉列表或相关元素
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (
      serverListRef.current &&
      relatedTarget &&
      serverListRef.current.contains(relatedTarget)
    ) {
      return; // 焦点在下拉列表中，不关闭
    }
    // 使用最短的延迟，确保点击事件先执行
    setTimeout(() => {
      if (serverListRef.current && !serverListRef.current.contains(document.activeElement)) {
        setShowServerList(false);
      }
    }, 50);
  };

  // 处理角色选择框失去焦点
  const handleCharacterBlur = (e: React.FocusEvent) => {
    // 检查焦点是否移动到下拉列表或相关元素
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (
      characterListRef.current &&
      relatedTarget &&
      characterListRef.current.contains(relatedTarget)
    ) {
      return; // 焦点在下拉列表中，不关闭
    }
    // 使用最短的延迟，确保点击事件先执行
    setTimeout(() => {
      if (characterListRef.current && !characterListRef.current.contains(document.activeElement)) {
        setShowCharacterList(false);
      }
    }, 50);
  };

  const handleConfirm = () => {
    if (!selectedServer) {
      return;
    }
    
    // 检查是否选择了角色（如果角色列表不为空，则必须选择角色）
    const modalGameRoles = effectiveAppKey ? getRolesByAppKey(effectiveAppKey) : [];
    const hasCharacters = modalGameRoles.some(
      (role) =>
        role.game_server_channel === selectedServer &&
        (!selectedServerPlatform || role.platform === selectedServerPlatform)
    );
    
    if (hasCharacters && !selectedCharacter) {
      // 如果有角色但未选择，提示用户选择角色
      // console.warn('请先选择角色');
      return;
    }
    
    // 获取选中角色的头像信息
    let selectedRoleAvatar: string | undefined;
    if (selectedCharacter) {
      const selectedRole = modalGameRoles.find((role) => role.game_user_id === selectedCharacter);
      if (selectedRole?.user_avatar) {
        selectedRoleAvatar = selectedRole.user_avatar;
      }
    }
    
    // 调用 onConfirm（可能是异步的，但不等待其完成），传入头像信息
    try {
      const result = onConfirm(selectedServer, selectedCharacter || '', gameUserId, selectedRoleAvatar);

      // 不等待 Promise 完成，让父组件处理异步逻辑
      if (result instanceof Promise) {
        result.catch((error) => {
          // console.error('onConfirm 执行出错:', error);
        });
      }
    } catch (error) {
      // console.error('调用 onConfirm 时出错:', error);
    } finally {
      onClose();
    }
  };

  // 过滤服务器列表
  const filteredServers = serverList.filter((serverItem) => {
    // 如果用户没有手动输入（仅回填），不做过滤，展示完整列表
    if (!hasUserTyped) return true;

    return serverItem.label.includes(searchText) || 
           serverItem.channel.includes(searchText) ||
           getPlatformLabel(serverItem.platform).toLowerCase().includes(searchText.toLowerCase());
  });

  useEffect(() => {
    if (!selectedServer) {
      setShowCharacterList(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    if (!showServerList) {
      setServerListScrollReady(false);
    }
  }, [showServerList]);

  useEffect(() => {
    if (!showCharacterList) {
      setCharacterListScrollReady(false);
    }
  }, [showCharacterList]);

  const handleServerDropdownTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'grid-template-rows' || event.target !== event.currentTarget) {
      return;
    }
    if (showServerList) {
      setServerListScrollReady(true);
    }
  };

  const handleCharacterDropdownTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'grid-template-rows' || event.target !== event.currentTarget) {
      return;
    }
    if (showCharacterList) {
      setCharacterListScrollReady(true);
    }
  };

  // 条件渲染必须在所有 hooks 之后
  useScrollLock(isOpen);

  if (!isOpen) return null;

  const canSelectCharacter = Boolean(selectedServer);
  const serverOptionCount = filteredServers.length > 0 ? filteredServers.length : 1;
  const serverListCapped = showServerList && serverOptionCount >= DROPDOWN_SCROLL_ITEM_THRESHOLD;
  const serverListScrollable = serverListCapped && serverListScrollReady;
  const characterListCapped = showCharacterList && characterList.length >= DROPDOWN_SCROLL_ITEM_THRESHOLD;
  const characterListScrollable = characterListCapped && characterListScrollReady;
  const serverPlaceholderText = t('serverSelect.serverPlaceholder');
  const showServerPlaceholder = !searchText && !isServerInputFocused;

  return (
    <div className={styles.overlay} data-scroll-lock-overlay onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="关闭" type="button">
          <img src={loginModalClose} alt="" className={styles.closeButtonImg} />
        </button>

        <h2 className={styles.title}>{t('serverSelect.title')}</h2>

        {/* 服务器选择 */}
        <div className={styles.inputGroup}>
          <div
            className={`${styles.selectControl} ${showServerList ? styles.selectControlOpen : ''} ${
              isServerInputFocused ? styles.selectControlKeyboardActive : ''
            }`}
          >
            <div
              className={`${styles.inputWrapper} ${
                showServerPlaceholder ? styles.inputWrapperWithServerPlaceholder : ''
              }`}
            >
              {showServerPlaceholder && (
                <div className={styles.serverPlaceholder} aria-hidden="true">
                  {serverPlaceholderText}
                </div>
              )}
              <input
                type="text"
                className={styles.input}
                aria-label={serverPlaceholderText}
                title={serverPlaceholderText}
                value={searchText}
                ref={serverInputRef}
                inputMode="text"
                autoComplete="off"
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setHasUserTyped(true);
                  setShowServerList(true);
                  if (!e.target.value) {
                    setSelectedServer('');
                    setSelectedServerPlatform('');
                    setSelectedCharacter('');
                  } else {
                    setShowServerList(true);
                  }
                }}
                onFocus={() => {
                  setIsServerInputFocused(true);
                  setHasUserTyped(false);
                  setShowCharacterList(false);
                  setShowServerList(true);
                }}
                onBlur={handleServerBlur}
              />
              <button
                type="button"
                className={styles.dropdownButton}
                onClick={() => {
                  blurServerInputWithoutClosingList();
                  setShowCharacterList(false);
                  setShowServerList(!showServerList);
                }}
              >
                <ChevronDownIcon
                  className={`${styles.chevron} ${showServerList ? styles.chevronOpen : ''}`}
                  color="#ff9a3d"
                />
              </button>
            </div>
            <div
              className={styles.dropdownCollapse}
              aria-hidden={!showServerList}
              onTransitionEnd={handleServerDropdownTransitionEnd}
            >
              <div
                className={`${styles.dropdownList} ${serverListCapped ? styles.dropdownListCapped : ''} ${
                  serverListScrollable ? styles.dropdownListScrollable : ''
                }`}
                ref={serverListRef}
                onPointerDown={blurServerInputWithoutClosingList}
                onTouchStart={blurServerInputWithoutClosingList}
              >
                {filteredServers.length > 0 ? (
                  filteredServers.map((serverItem) => (
                    <div
                      key={`${serverItem.channel}_${serverItem.platform}`}
                      className={`${styles.dropdownItem} ${
                        selectedServer === serverItem.channel && selectedServerPlatform === serverItem.platform
                          ? styles.dropdownItemSelected
                          : ''
                      }`}
                      onClick={() => handleServerSelect(serverItem)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {serverItem.label}
                    </div>
                  ))
                ) : (
                  <div className={styles.dropdownItemEmpty}>{t('serverSelect.noResults')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 角色选择 */}
        <div className={styles.inputGroup}>
          <div
            className={`${styles.selectControl} ${showCharacterList ? styles.selectControlOpen : ''} ${
              !canSelectCharacter ? styles.selectControlDisabled : ''
            }`}
          >
            <div className={styles.inputWrapper}>
              <div
                className={`${styles.characterInput} ${!canSelectCharacter ? styles.characterInputDisabled : ''}`}
                onClick={() => {
                  if (canSelectCharacter) {
                    setShowServerList(false);
                    setShowCharacterList(!showCharacterList);
                  }
                }}
                onBlur={handleCharacterBlur}
                tabIndex={canSelectCharacter ? 0 : -1}
                role="button"
                aria-disabled={!canSelectCharacter}
              >
                {selectedCharacter ? (
                  <div className={styles.characterName}>{getSelectedCharacterName()}</div>
                ) : (
                  <div className={styles.characterPlaceholder}>
                    {t('serverSelect.characterPlaceholder')}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={styles.dropdownButton}
                disabled={!canSelectCharacter}
                onClick={() => {
                  if (canSelectCharacter) {
                    setShowServerList(false);
                    setShowCharacterList(!showCharacterList);
                  }
                }}
              >
                <ChevronDownIcon
                  className={`${styles.chevron} ${showCharacterList ? styles.chevronOpen : ''}`}
                  color="#ff9a3d"
                />
              </button>
            </div>
            <div
              className={styles.dropdownCollapse}
              aria-hidden={!showCharacterList || !canSelectCharacter}
              onTransitionEnd={handleCharacterDropdownTransitionEnd}
            >
              <div
                className={`${styles.dropdownList} ${characterListCapped ? styles.dropdownListCapped : ''} ${
                  characterListScrollable ? styles.dropdownListScrollable : ''
                }`}
                ref={characterListRef}
              >
                {characterList.length > 0 ? (
                  characterList.map((character) => (
                    <div
                      key={character.value}
                      className={`${styles.dropdownItem} ${
                        selectedCharacter === character.value ? styles.dropdownItemSelected : ''
                      }`}
                      onClick={() => handleCharacterSelect(character.value)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {character.label}
                    </div>
                  ))
                ) : (
                  <div className={styles.dropdownItemEmpty}>{t('serverSelect.noResults')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 确定按钮 */}
        <button type="button" className={styles.confirmButton} onClick={handleConfirm}>
          {t('serverSelect.confirm')}
        </button>
      </div>
    </div>
  );
};
