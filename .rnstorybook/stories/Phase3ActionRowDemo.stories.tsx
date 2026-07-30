import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase3ActionRowDemo } from "./Phase3ActionRowDemo";

const meta = {
  title: "YouTrader/Phase3/ActionRow",
  component: Phase3ActionRowDemo,
} satisfies Meta<typeof Phase3ActionRowDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = { args: { variant: "titleOnly" } };
export const TitleSubtitle: Story = { args: { variant: "titleSubtitle" } };
export const TrailingValue: Story = { args: { variant: "trailing" } };
export const LongLocalized: Story = { args: { variant: "longLocalized" } };
export const LargeFont: Story = { args: { variant: "largeFont" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const DarkMode: Story = { args: { variant: "dark" } };
export const LightMode: Story = { args: { variant: "light" } };
