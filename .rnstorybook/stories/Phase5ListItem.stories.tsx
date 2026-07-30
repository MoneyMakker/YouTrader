import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5ListItemDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/ListItem",
  component: Phase5ListItemDemo,
} satisfies Meta<typeof Phase5ListItemDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = { args: { variant: "title" } };
export const Subtitle: Story = { args: { variant: "subtitle" } };
export const Trailing: Story = { args: { variant: "trailing" } };
export const Selected: Story = { args: { variant: "selected" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const LongLocalization: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
