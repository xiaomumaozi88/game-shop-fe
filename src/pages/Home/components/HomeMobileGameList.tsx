import React from 'react';
import { Game } from '../Home';
import goArrowIcon from '@/assets/img2/mobile-game-card-go-white-arrow.png';
import styles from '../Home.module.less';

interface HomeMobileGameListProps {
  games: Game[];
  onGameClick: (gameId: string) => void;
  title: string;
  goLabel: string;
}

export const HomeMobileGameList: React.FC<HomeMobileGameListProps> = ({
  games,
  onGameClick,
  title,
  goLabel,
}) => (
  <section className={styles.mobileGameSection}>
    <h2 className={styles.mobileGameSectionTitle}>{title}</h2>
    <div className={styles.mobileGameSectionAccent} aria-hidden />
    <ul className={styles.mobileGameList}>
      {games.map((game) => (
        <li key={game.id}>
          <button
            type="button"
            className={styles.mobileGameCard}
            data-game={game.id}
            aria-label={game.name}
            onClick={() => onGameClick(game.id)}
          >
            <img
              src={game.mobileBannerImage}
              alt=""
              className={styles.mobileGameCardArt}
              aria-hidden
              loading="lazy"
              decoding="async"
            />
            <span className={styles.mobileGameCardGo} aria-hidden>
              <span className={styles.mobileGameCardGoText}>{goLabel}</span>
              <img src={goArrowIcon} alt="" className={styles.mobileGameCardGoIcon} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);
