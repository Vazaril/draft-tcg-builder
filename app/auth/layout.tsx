import { SplitPage, SplitPageFormPane, SplitPageShowcasePane } from '@/components/ui/split-page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { siteConfig } from '@/config/site';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplitPage>
      <SplitPageFormPane>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-2 text-center lg:text-left">
            <h1 className="font-pixel text-4xl font-bold text-primary">{siteConfig.title}</h1>
            <p className="text-base">{siteConfig.slogan}</p>
          </div>
          {children}
          <div className="mt-8 flex justify-center lg:justify-start">
            <ThemeSwitcher />
          </div>
        </div>
      </SplitPageFormPane>
      <SplitPageShowcasePane
        className={'bg-gradient-to-br from-background via-background to-primary/5 p-6 md:p-8'}
      >
        <div className="flex w-full max-w-lg flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-pixel text-2xl">What is Draft?</CardTitle>
              <CardDescription>{siteConfig.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-foreground">
              <p>
                <strong className={'text-primary'}>Build:</strong> Construct competitive decks using
                our advanced filtering system.
              </p>
              <p>
                <strong className={'text-primary'}>Analyze:</strong> Test your mana curves and draw
                probabilities before hitting the table.
              </p>
              <p>
                <strong className={'text-primary'}>Share:</strong> Publish your creations to the
                global DRAFT network.
              </p>
            </CardContent>
          </Card>
        </div>
      </SplitPageShowcasePane>
    </SplitPage>
  );
}
