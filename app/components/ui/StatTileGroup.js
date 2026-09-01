import StatTile from './StatTile';

export default function StatTileGroup({ tiles }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <StatTile key={tile.label} value={tile.value} label={tile.label} />
      ))}
    </div>
  );
}
