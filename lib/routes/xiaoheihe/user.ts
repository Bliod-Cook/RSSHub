import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { calculate } from './util';

export const route: Route = {
    path: '/user/:id',
    categories: ['game'],
    example: '/xiaoheihe/user/30664023',
    parameters: { id: '用户 ID' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '用户动态',
    maintainers: ['tssujt'],
    handler,
};

async function handler(ctx) {
    const userId = ctx.req.param('id');

    const userResponse = await got({
        method: 'get',
        url: `https://api.xiaoheihe.cn/bbs/app/profile/user/profile?lang=zh-cn&version=1.3.303&userid=${userId}`,
    });
    const username = userResponse.data.result.account_detail.username;
    const postNum = Number(userResponse.data.result.account_detail.bbs_info.post_link_num);

    const urls: any[] = [];
    for (let i = 0; i < postNum; i += 50) {
        urls.push(`https://api.xiaoheihe.cn/bbs/web/profile/post/links?userid=${userId}&limit=50&offset=${i}&version=999.0.0`);
    }

    const itemsList = await Promise.all(urls.map(async (url) => await get_post(url)));

    let items: any[] = [];
    for (const per_items of itemsList) {
        items = [...items, ...per_items];
    }

    return {
        title: `${username} 的动态`,
        link: `https://xiaoheihe.cn`,
        item: items,
    };
}

async function get_post(url: string) {
    const response = await got({
        method: 'get',
        url,
    });
    const data = response.data.post_links.filter((item) => item.linkid !== undefined);

    let items = data.map((item) => ({
        linkId: item.linkid,
        link: `https://api.xiaoheihe.cn/v3/bbs/app/api/web/share?link_id=${item.linkid}`,
        title: item.title,
        pubDate: parseDate(item.modify_at * 1000),
        description: item.description,
    }));
    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link, async () => {
                const dataUrl = calculate(
                    `https://api.xiaoheihe.cn/bbs/app/api/share/data/?os_type=web&app=heybox&client_type=mobile&version=999.0.3&x_client_type=web&x_os_type=Mac&x_app=heybox&heybox_id=-1&offset=0&limit=3&link_id=${item.linkId}&use_concept_type=`
                );
                const dataResponse = await got({
                    method: 'get',
                    url: dataUrl,
                });
                item.description = dataResponse.data.link.content[0].text;
                delete item.linkId;
                return item;
            })
        )
    );

    return items;
}
