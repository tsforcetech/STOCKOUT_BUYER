import {
  BathtubIcon,
  BulldozerIcon,
  ChairIcon,
  ColumnsIcon,
  CubeIcon,
  DoorIcon,
  DropIcon,
  FanIcon,
  FireExtinguisherIcon,
  FrameCornersIcon,
  GridFourIcon,
  HardHatIcon,
  LightbulbIcon,
  LightningIcon,
  NutIcon,
  PaintRollerIcon,
  PipeIcon,
  SnowflakeIcon,
  TreeEvergreenIcon,
  WallIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react";

/** Ordered: the first pattern that matches a category name wins (the category API has no icon field). */
const CATEGORY_ICONS: Array<[RegExp, Icon]> = [
  [/fire/i, FireExtinguisherIcon],
  [/plumb|pipe|ppr|hdpe|upvc|drain/i, PipeIcon],
  [/light|lamp|led/i, LightbulbIcon],
  [/electr|cable|switch|wire|breaker/i, LightningIcon],
  [/hvac|air con|ventilat|duct/i, FanIcon],
  [/steel|metal|rebar|alumin/i, ColumnsIcon],
  [/tile|floor|marble|granite/i, GridFourIcon],
  [/paint|coating|primer/i, PaintRollerIcon],
  [/door|window|shutter/i, DoorIcon],
  [/sanitary|bath|shower|wc|basin/i, BathtubIcon],
  [/pump|valve|water/i, DropIcon],
  [/fasten|hardware|bolt|screw|anchor/i, NutIcon],
  [/tool|equipment/i, WrenchIcon],
  [/safety|ppe|helmet/i, HardHatIcon],
  [/machin|plant|excavat|forklift|crane/i, BulldozerIcon],
  [/insulat|thermal/i, SnowflakeIcon],
  [/wood|timber|plywood|panel/i, TreeEvergreenIcon],
  [/glass|facade|façade|cladding/i, FrameCornersIcon],
  [/furniture|office|fit-?out|chair|desk/i, ChairIcon],
  [/build|cement|concrete|block|brick|gypsum/i, WallIcon],
];

export function categoryIcon(name: string): Icon {
  return CATEGORY_ICONS.find(([re]) => re.test(name))?.[1] ?? CubeIcon;
}
