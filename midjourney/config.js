// Cấu hình cho API Midjourney
const config = {
  // URL API
  apiUrl: 'https://www.midjourney.com/api/submit-jobs',
  
  // Headers cần thiết
  headers: {
    'accept': '*/*',
    'accept-language': 'vi,en;q=0.9,en-GB;q=0.8,en-US;q=0.7',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'origin': 'https://www.midjourney.com',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://www.midjourney.com/imagine',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',
    'x-csrf-protection': '1'
  },
  
  // Cookies - CẬP NHẬT THÔNG TIN NÀY TỪ BROWSER CỦA BẠN
  cookies: {
    '__Host-Midjourney.AuthUserTokenV3_r': 'AMf-vBzD-RMmvRyOPpx90-T8XfuxIXJ2uxoHgCxYv7aSXFqNJo82p455ZVPN5YEj4p918St7efXSvSw-V9WXdZRc5cqCWTV0vi3xJ5ICgAtK561Pi5fuSORbzkgtZe9jgnssmRR7yHHnfyBcaSpQUqoxORbipxOW1gQ0FJ2tU4clb_g-C3cY-LKRiai75W6nOrKsugrG37mlHKp5tqP25T1kcOMNuTk3mcs1nNpCG-D4xX7SPG0N6Vsaq5efxKbb65W8Q-B8zS9OJCWUV1pdxThr3PmKltqZSs5PgIXT0TVZfeAUwwC4Wv_CVgwT3Yuodmcz55QXii2vS9BQG1otob3hPhzjBnWlMx_6WswUsMkieQkwW0qGT8XF8Vd1Z-mTmbH-oH83DZc9uwDuHK4t5xHOjmJP3Yz8VQyIN1E3AQ2uw-RGDBL84vg',
    '__Host-Midjourney.AuthUserTokenV3_i': 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjNiZjA1MzkxMzk2OTEzYTc4ZWM4MGY0MjcwMzM4NjM2NDA2MTBhZGMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoidTI4OTM5Nzk2OTgiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS0dEdHY4N3FnczR2RFhuck83a2NNVl9mcy1iYjdrWXlmd3QxV3pnV2lYeDczVUhBPXM5Ni1jIiwibWlkam91cm5leV9pZCI6IjY4NTQ2N2M4LTZkODgtNDY5Zi1hZDYyLTYxYmM4M2Q3MWU0MCIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdXRoam91cm5leSIsImF1ZCI6ImF1dGhqb3VybmV5IiwiYXV0aF90aW1lIjoxNzUwMDY2MTAxLCJ1c2VyX2lkIjoibW91UVBXOVlwcVFqTDFuMDhUSkhhM0ViMHBUMiIsInN1YiI6Im1vdVFQVzlZcHFRakwxbjA4VEpIYTNFYjBwVDIiLCJpYXQiOjE3NTA2MDI0MDksImV4cCI6MTc1MDYwNjAwOSwiZW1haWwiOiJ0Ym12MjAyMkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwMTEzMDYxMjE5MDM0MTE4NjU1OSJdLCJlbWFpbCI6WyJ0Ym12MjAyMkBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.UDbzVQf-JVJ61xnQ6GZWRupvPzauhh0wg018akUuYlEvSvNX5mP-iFJc1Nc8zZtY1twkxexNbUZSSW1fieq7bRGtIRqqcp2JBFqYd_lIfh11KTXYoJ0renHpSPGIGIC0L4ELobEDsXwKxf5JtnH-63foEQRV_NhjedoGBs-CDtQi4ngj_OKZ2vgIUZ5hmVk1A5SAzv8J_uUR4-8rl52At3f5z_SJmYfxPqWB-Hf2b0-0yE8pD8dSufQAxsn3PvHv_DMI9mPqXuxURkLVW-PbryAeqPNmX0TLNUQBxOgxcRdxt7w4lWOSb2j5Vb7zZjWuRhACeOBY5yOmQkLPZKDkTA',
    '__cf_bm': 'LDRRDISItKSc1vtswPH5DrbTC6D1oXSWRlI98FoibdI-1750602409-1.0.1.1-ofuTNGjZlpfDiVGUD2M52.M7qtjlTCAoSV5rEXIwebdA3cCkw9o0p1N8IIVI2Cel_2aCp_fJWeWPLQ4Rs7V3iW8hKLwXMJEYHmZKrFCRmHQ',
    '_cfuvid': 'XuRYXV.lUlFsP43tOfNeMJu_qDqU2Qzhct5z.iSyJfo-1750602409504-0.0.1.1-604800000',
    'AMP_MKTG_437c42b22c': 'JTdCJTIycmVmZXJyZXIlMjIlM0ElMjJodHRwcyUzQSUyRiUyRnd3dy5iaW5nLmNvbSUyRiUyMiUyQyUyMnJlZmVycmluZ19kb21haW4lMjIlM0ElMjJ3d3cuYmluZy5jb20lMjIlN0Q=',
    'cf_clearance': 'YU3ERoq98l0Bty20i65p6gK_BdxLb8__pPUDaUvhjuU-1750602411-1.2.1.1-YlBBxLjbf4C8Hj4YP.UooOJvG2PmTadTdWlhDQwUQU9GhQX9jn2Tu.RBymk7ev7uae4.cZhATCK6_OB4A_qUd.NdQUzQDBjIret_WyO4FdGY6e.o01w1ELaD.MwdZBcL3smrtJKt_IgRARMiI51BN3a3VUfmYbPMkVxi1f8xiCRSHj1kPxv.el9W1J9k5M8UyhKSXvfx2.gmJzLf3Z0Ic3FIJqhn3tRev19XPAq1SccAnHaLkNRex58ZrTaohwgrHLoiw9rImfPGUrP7W82jdNDT5KpzXAixYoFnkBHeykavsyaFG0bdUVcSAsYFjUSXFFRooWMvnNTATYavVUGtX87b9.O4i0vrsHWIS8uYdo8',
    'AMP_437c42b22c': 'JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjJmODE2Njk1OC00YjFjLTQ0YzctYTliYS0zYzRjZWRkMWM2ZGYlMjIlMkMlMjJ1c2VySWQlMjIlM0ElMjI2ODU0NjdjOC02ZDg4LTQ2OWYtYWQ2Mi02MWJjODNkNzFlNDAlMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzUwNjAyNDEwNjc1JTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc1MDYwMjYwNzEzMyUyQyUyMmxhc3RFdmVudElkJTIyJTNBODglN0Q=',
    '_dd_s': 'logs=1&id=71d6f829-adc8-41f7-9014-64c07efe3e17&created=1750602410111&expire=1750603568071'
  },
  
  // Channel ID - CẬP NHẬT THÔNG TIN NÀY
  channelId: 'singleplayer_685467c8-6d88-469f-ad62-61bc83d71e40'
};

module.exports = config; 